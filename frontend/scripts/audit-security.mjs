import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ADVISORY_URL =
  /^https:\/\/github\.com\/advisories\/(GHSA-[0-9a-z]+-[0-9a-z]+-[0-9a-z]+)$/i;
const TRACKING_ISSUE =
  /^https:\/\/github\.com\/edupinhata\/EuChef\/issues\/[1-9][0-9]*$/;
const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const APPROVED_POLICY = {
  expiresOn: "2026-08-10",
  trackingIssue: "https://github.com/edupinhata/EuChef/issues/21",
  reason:
    "EuChef uses SPA routing only and does not use the affected React Server Components mode or Server Actions.",
  advisoryId: "GHSA-qwww-vcr4-c8h2",
  packages: ["react-router", "react-router-dom"],
  causesByPackage: {
    "react-router": {
      advisories: ["GHSA-qwww-vcr4-c8h2"],
      dependencies: [],
    },
    "react-router-dom": {
      advisories: [],
      dependencies: ["react-router"],
    },
  },
};

export class AuditPolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuditPolicyError";
  }
}

function sorted(values) {
  return [...values].sort();
}

function sameValues(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

export function evaluateAudit({ audit, allowlist, now = new Date() }) {
  if (allowlist?.schemaVersion !== 1) {
    throw new AuditPolicyError("Unsupported security audit allowlist schema");
  }
  if (!TRACKING_ISSUE.test(allowlist.trackingIssue ?? "")) {
    throw new AuditPolicyError(
      "Security audit exception requires a canonical EuChef tracking issue",
    );
  }
  const configuredAdvisory = allowlist.advisories?.[0];
  const allowlistKeys = [
    "schemaVersion",
    "expiresOn",
    "trackingIssue",
    "reason",
    "advisories",
  ];
  const advisoryKeys = ["id", "packages"];
  if (
    !sameValues(Object.keys(allowlist), allowlistKeys) ||
    !sameValues(Object.keys(configuredAdvisory ?? {}), advisoryKeys) ||
    allowlist.expiresOn !== APPROVED_POLICY.expiresOn ||
    allowlist.trackingIssue !== APPROVED_POLICY.trackingIssue ||
    allowlist.reason !== APPROVED_POLICY.reason ||
    allowlist.advisories?.length !== 1 ||
    configuredAdvisory?.id !== APPROVED_POLICY.advisoryId ||
    !sameValues(configuredAdvisory?.packages ?? [], APPROVED_POLICY.packages)
  ) {
    throw new AuditPolicyError(
      "Security audit allowlist exceeds the approved policy",
    );
  }
  if (audit?.error != null) {
    throw new AuditPolicyError("npm audit returned an error response");
  }
  if (
    audit === null ||
    typeof audit !== "object" ||
    audit.auditReportVersion !== 2 ||
    audit.vulnerabilities === null ||
    typeof audit.vulnerabilities !== "object" ||
    Array.isArray(audit.vulnerabilities) ||
    audit.metadata?.vulnerabilities === null ||
    typeof audit.metadata?.vulnerabilities !== "object"
  ) {
    throw new AuditPolicyError("npm audit returned an unsupported response");
  }

  const vulnerabilityMetadata = audit.metadata.vulnerabilities;
  const allEntries = Object.entries(audit.vulnerabilities);
  const expectedMetadataKeys = [...SEVERITIES, "total"];
  const metadataIsValid =
    sameValues(Object.keys(vulnerabilityMetadata), expectedMetadataKeys) &&
    expectedMetadataKeys.every(
      (severity) =>
        Number.isInteger(vulnerabilityMetadata[severity]) &&
        vulnerabilityMetadata[severity] >= 0,
    );
  const entriesAreValid = allEntries.every(
    ([name, value]) =>
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.name === name &&
      SEVERITIES.includes(value.severity),
  );
  const actualCounts = Object.fromEntries(
    SEVERITIES.map((severity) => [
      severity,
      allEntries.filter(([, value]) => value?.severity === severity).length,
    ]),
  );
  const totalsAreConsistent =
    metadataIsValid &&
    entriesAreValid &&
    SEVERITIES.every(
      (severity) => actualCounts[severity] === vulnerabilityMetadata[severity],
    ) &&
    vulnerabilityMetadata.total === allEntries.length &&
    vulnerabilityMetadata.total ===
      SEVERITIES.reduce(
        (total, severity) => total + vulnerabilityMetadata[severity],
        0,
      );
  if (!totalsAreConsistent) {
    throw new AuditPolicyError(
      "npm audit returned inconsistent vulnerability metadata",
    );
  }

  const nonSevereCausesAreValid = allEntries
    .filter(([, value]) => !["high", "critical"].includes(value.severity))
    .every(
      ([name, value]) =>
        Array.isArray(value.via) &&
        value.via.length > 0 &&
        value.via.every((cause) => {
          if (typeof cause === "string") {
            const dependency = audit.vulnerabilities[cause];
            return (
              cause.length > 0 &&
              Object.prototype.hasOwnProperty.call(
                audit.vulnerabilities,
                cause,
              ) &&
              dependency !== undefined &&
              SEVERITIES.indexOf(dependency.severity) <=
                SEVERITIES.indexOf(value.severity)
            );
          }
          const advisoryMatch =
            typeof cause?.url === "string"
              ? ADVISORY_URL.exec(cause.url)
              : null;
          return (
            cause !== null &&
            typeof cause === "object" &&
            cause.name === name &&
            cause.dependency === name &&
            SEVERITIES.includes(cause.severity) &&
            SEVERITIES.indexOf(cause.severity) <=
              SEVERITIES.indexOf(value.severity) &&
            advisoryMatch !== null &&
            advisoryMatch[1].toLowerCase() !==
              APPROVED_POLICY.advisoryId.toLowerCase()
          );
        }),
    );
  if (!nonSevereCausesAreValid) {
    throw new AuditPolicyError("npm audit returned an unsupported response");
  }

  const severeEntries = allEntries.filter(([, value]) =>
    ["high", "critical"].includes(value.severity),
  );
  if (severeEntries.length === 0) {
    return {
      accepted: true,
      acceptedAdvisories: [],
    };
  }

  const expiration = new Date(`${allowlist.expiresOn}T23:59:59.999Z`);
  if (!Number.isFinite(expiration.getTime()) || now > expiration) {
    throw new AuditPolicyError(
      `Security audit exception expired on ${allowlist.expiresOn}`,
    );
  }

  const actualPackages = severeEntries.map(([name]) => name);
  const allowedPackages = allowlist.advisories.flatMap(
    (entry) => entry.packages,
  );
  if (!sameValues(actualPackages, allowedPackages)) {
    throw new AuditPolicyError(
      "High or critical vulnerability packages do not match the allowlist",
    );
  }
  const allowedPackageSet = new Set(allowedPackages);

  const actualAdvisories = new Set();
  for (const [packageName, vulnerability] of severeEntries) {
    if (vulnerability.severity === "critical") {
      throw new AuditPolicyError(
        "Critical vulnerabilities cannot be allowlisted",
      );
    }
    if (!Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
      throw new AuditPolicyError("Audit causes must be a non-empty array");
    }

    const packageAdvisories = [];
    const packageDependencies = [];
    for (const cause of vulnerability.via) {
      if (typeof cause === "string") {
        if (!allowedPackageSet.has(cause)) {
          throw new AuditPolicyError(
            `Audit dependency path is outside the allowlist: ${cause}`,
          );
        }
        packageDependencies.push(cause);
      } else if (typeof cause === "object" && cause !== null) {
        if (cause.severity !== "high") {
          throw new AuditPolicyError(
            "Audit advisory object must have high severity",
          );
        }
        const match = cause.url?.match(ADVISORY_URL);
        if (!match) {
          throw new AuditPolicyError(
            "Audit advisory object is not a canonical GHSA",
          );
        }
        if (cause.name !== packageName || cause.dependency !== packageName) {
          throw new AuditPolicyError(
            "npm audit returned an unsupported response",
          );
        }
        actualAdvisories.add(match[1]);
        packageAdvisories.push(match[1]);
      } else {
        throw new AuditPolicyError("Audit cause has an unsupported type");
      }
    }

    const expectedCauses = APPROVED_POLICY.causesByPackage[packageName];
    if (
      !expectedCauses ||
      !sameValues(packageAdvisories, expectedCauses.advisories) ||
      !sameValues(packageDependencies, expectedCauses.dependencies)
    ) {
      throw new AuditPolicyError(
        "Audit causes do not match the approved package relationship",
      );
    }
  }

  const allowedAdvisories = allowlist.advisories.map((entry) => entry.id);
  if (!sameValues(actualAdvisories, allowedAdvisories)) {
    throw new AuditPolicyError("Audit advisories do not match the allowlist");
  }

  return {
    accepted: true,
    acceptedAdvisories: sorted(actualAdvisories),
  };
}

function loadJson(path, description) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new AuditPolicyError(
      `Unable to read ${description}: ${error.message}`,
    );
  }
}

function collectAudit() {
  const npmExecutable = process.env.npm_execpath;
  if (!npmExecutable) {
    throw new AuditPolicyError(
      "Run the security audit through npm run audit:security",
    );
  }

  const result = spawnSync(
    process.execPath,
    [npmExecutable, "audit", "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (result.error) {
    throw new AuditPolicyError(
      `Unable to execute npm audit: ${result.error.message}`,
    );
  }
  if (![0, 1].includes(result.status)) {
    throw new AuditPolicyError(
      `npm audit failed with exit code ${result.status}: ${result.stderr.trim()}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new AuditPolicyError("npm audit returned invalid JSON");
  }
}

async function main() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const allowlistPath = resolve(
    scriptDirectory,
    "../security/npm-audit-allowlist.json",
  );
  const allowlist = loadJson(allowlistPath, "security audit allowlist");
  const result = evaluateAudit({ audit: collectAudit(), allowlist });

  if (result.acceptedAdvisories.length === 0) {
    console.log(
      "Security audit passed with no high or critical vulnerabilities.",
    );
    return;
  }

  console.warn(
    `::warning title=Temporary npm audit exception::Accepted ${result.acceptedAdvisories.join(
      ", ",
    )} until ${allowlist.expiresOn}. Tracking: ${allowlist.trackingIssue}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
