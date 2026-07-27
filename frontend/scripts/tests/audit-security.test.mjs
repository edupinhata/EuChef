import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateAudit } from "../audit-security.mjs";

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const RSC_PATTERNS = [
  /react-server/i,
  /["']use server["']/i,
  /\bRSC\b/,
  /ServerAction/i,
  /unstable_.*RSC/i,
  /@vitejs\/plugin-rsc/i,
];
const EXECUTABLE_EXTENSIONS = new Set([
  ".bash",
  ".bat",
  ".cjs",
  ".cmd",
  ".conf",
  ".cts",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".mts",
  ".ps1",
  ".properties",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
  ".xml",
]);
const EXCLUDED_DIRECTORIES = new Set(["coverage", "dist", "node_modules"]);

function findRscUsage(projectDirectory, excludedFiles = new Set()) {
  const findings = [];

  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory() && !EXCLUDED_DIRECTORIES.has(entry.name)) {
        scan(path);
      } else if (
        entry.isFile() &&
        !excludedFiles.has(path) &&
        (EXECUTABLE_EXTENSIONS.has(extname(path).toLowerCase()) ||
          extname(path) === "" ||
          entry.name === "Dockerfile" ||
          entry.name.startsWith("Dockerfile.") ||
          entry.name === ".env" ||
          entry.name.startsWith(".env."))
      ) {
        const contents = readFileSync(path, "utf8");
        if (RSC_PATTERNS.some((pattern) => pattern.test(contents))) {
          findings.push(path);
        }
      }
    }
  }

  scan(projectDirectory);
  return findings;
}

const acceptedAudit = {
  auditReportVersion: 2,
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 2,
      critical: 0,
      total: 2,
    },
  },
  vulnerabilities: {
    "react-router": {
      name: "react-router",
      severity: "high",
      via: [
        {
          name: "react-router",
          dependency: "react-router",
          url: "https://github.com/advisories/GHSA-qwww-vcr4-c8h2",
          severity: "high",
        },
      ],
    },
    "react-router-dom": {
      name: "react-router-dom",
      severity: "high",
      via: ["react-router"],
    },
  },
};

const allowlist = {
  schemaVersion: 1,
  expiresOn: "2026-08-10",
  trackingIssue: "https://github.com/edupinhata/EuChef/issues/21",
  reason:
    "EuChef uses SPA routing only and does not use the affected React Server Components mode or Server Actions.",
  advisories: [
    {
      id: "GHSA-qwww-vcr4-c8h2",
      packages: ["react-router", "react-router-dom"],
    },
  ],
};

test("accepts only the allowlisted advisory before expiration", () => {
  const result = evaluateAudit({
    audit: acceptedAudit,
    allowlist,
    now: new Date("2026-07-27T00:00:00Z"),
  });

  assert.deepEqual(result, {
    accepted: true,
    acceptedAdvisories: ["GHSA-qwww-vcr4-c8h2"],
  });
});

test("accepts a clean audit after the exception expires", () => {
  const result = evaluateAudit({
    audit: {
      auditReportVersion: 2,
      metadata: {
        vulnerabilities: {
          info: 0,
          low: 0,
          moderate: 0,
          high: 0,
          critical: 0,
          total: 0,
        },
      },
      vulnerabilities: {},
    },
    allowlist,
    now: new Date("2026-08-11T00:00:00Z"),
  });

  assert.deepEqual(result, {
    accepted: true,
    acceptedAdvisories: [],
  });
});

test("rejects an unsupported allowlist schema", () => {
  assert.throws(
    () =>
      evaluateAudit({
        audit: acceptedAudit,
        allowlist: { ...allowlist, schemaVersion: 2 },
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    {
      name: "AuditPolicyError",
      message: "Unsupported security audit allowlist schema",
    },
  );
});

test("rejects dependency paths outside the allowed package set", () => {
  const audit = structuredClone(acceptedAudit);
  audit.vulnerabilities["react-router-dom"].via = ["unexpected-package"];

  assert.throws(
    () =>
      evaluateAudit({
        audit,
        allowlist,
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    {
      name: "AuditPolicyError",
      message:
        "Audit dependency path is outside the allowlist: unexpected-package",
    },
  );
});

test("rejects an exception without a canonical tracking issue", () => {
  assert.throws(
    () =>
      evaluateAudit({
        audit: acceptedAudit,
        allowlist: { ...allowlist, trackingIssue: "" },
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    {
      name: "AuditPolicyError",
      message:
        "Security audit exception requires a canonical EuChef tracking issue",
    },
  );
});

test("rejects a tracking issue other than the approved issue", () => {
  assert.throws(
    () =>
      evaluateAudit({
        audit: {
          ...acceptedAudit,
          vulnerabilities: structuredClone(acceptedAudit.vulnerabilities),
        },
        allowlist: {
          ...allowlist,
          trackingIssue: "https://github.com/edupinhata/EuChef/issues/999",
        },
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    /Security audit allowlist exceeds the approved policy/,
  );
});

test("rejects changes to the approved policy bounds", async (t) => {
  const mutations = [
    ["expiration", { expiresOn: "2026-08-11" }],
    [
      "advisory",
      {
        advisories: [
          {
            id: "GHSA-xxxx-yyyy-zzzz",
            packages: ["react-router", "react-router-dom"],
          },
        ],
      },
    ],
    [
      "packages",
      {
        advisories: [
          {
            id: "GHSA-qwww-vcr4-c8h2",
            packages: ["react-router", "react-router-dom", "another-package"],
          },
        ],
      },
    ],
    ["reason", { reason: "broader exception" }],
    ["extra top-level field", { unexpected: true }],
    [
      "extra advisory field",
      {
        advisories: [
          {
            ...allowlist.advisories[0],
            unexpected: true,
          },
        ],
      },
    ],
  ];

  for (const [name, mutation] of mutations) {
    await t.test(name, () => {
      assert.throws(
        () =>
          evaluateAudit({
            audit: acceptedAudit,
            allowlist: { ...allowlist, ...mutation },
            now: new Date("2026-07-27T00:00:00Z"),
          }),
        /Security audit allowlist exceeds the approved policy/,
      );
    });
  }
});

test("rejects an incomplete npm audit response", () => {
  assert.throws(
    () =>
      evaluateAudit({
        audit: {},
        allowlist,
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    {
      name: "AuditPolicyError",
      message: "npm audit returned an unsupported response",
    },
  );
});

test("rejects inconsistent global severity metadata and entries", async (t) => {
  const mutations = [
    [
      "incorrect total",
      (audit) => (audit.metadata.vulnerabilities.total = 999),
    ],
    ["missing total", (audit) => delete audit.metadata.vulnerabilities.total],
    [
      "inconsistent moderate",
      (audit) => (audit.metadata.vulnerabilities.moderate = 7),
    ],
    [
      "unknown package severity",
      (audit) => {
        audit.vulnerabilities["hidden-package"] = {
          severity: undefined,
          via: [],
        };
        audit.metadata.vulnerabilities.total = 3;
      },
    ],
  ];

  for (const [name, mutate] of mutations) {
    await t.test(name, () => {
      const audit = structuredClone(acceptedAudit);
      mutate(audit);

      assert.throws(
        () =>
          evaluateAudit({
            audit,
            allowlist,
            now: new Date("2026-07-27T00:00:00Z"),
          }),
        /npm audit returned inconsistent vulnerability metadata/,
      );
    });
  }
});

test("rejects unknown metadata keys and malformed causes at any severity", async (t) => {
  const mutations = [
    [
      "unknown metadata severity",
      (audit) => (audit.metadata.vulnerabilities.unknown = 0),
    ],
    [
      "malformed moderate advisory",
      (audit) => {
        audit.vulnerabilities["moderate-package"] = {
          name: "moderate-package",
          severity: "moderate",
          via: [{ severity: "moderate" }],
        };
        audit.metadata.vulnerabilities.moderate = 1;
        audit.metadata.vulnerabilities.total = 3;
      },
    ],
    ...["high", "critical"].map((severity) => [
      `${severity} advisory hidden under moderate entry`,
      (audit) => {
        audit.vulnerabilities["moderate-package"] = {
          name: "moderate-package",
          severity: "moderate",
          via: [
            {
              name: "moderate-package",
              dependency: "moderate-package",
              severity,
              url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
            },
          ],
        };
        audit.metadata.vulnerabilities.moderate = 1;
        audit.metadata.vulnerabilities.total = 3;
      },
    ]),
    [
      "higher-severity dependency hidden under moderate entry",
      (audit) => {
        audit.vulnerabilities["moderate-package"] = {
          name: "moderate-package",
          severity: "moderate",
          via: ["react-router"],
        };
        audit.metadata.vulnerabilities.moderate = 1;
        audit.metadata.vulnerabilities.total = 3;
      },
    ],
    ...["constructor", "toString", "__proto__", "hasOwnProperty"].map(
      (dependencyName) => [
        `prototype dependency ${dependencyName}`,
        (audit) => {
          audit.vulnerabilities["moderate-package"] = {
            name: "moderate-package",
            severity: "moderate",
            via: [dependencyName],
          };
          audit.metadata.vulnerabilities.moderate = 1;
          audit.metadata.vulnerabilities.total = 3;
        },
      ],
    ),
  ];

  for (const [name, mutate] of mutations) {
    await t.test(name, () => {
      const audit = structuredClone(acceptedAudit);
      mutate(audit);

      assert.throws(
        () =>
          evaluateAudit({
            audit,
            allowlist,
            now: new Date("2026-07-27T00:00:00Z"),
          }),
        /npm audit returned (?:an unsupported response|inconsistent vulnerability metadata)/,
      );
    });
  }
});

test("rejects the approved high advisory when downgraded", async (t) => {
  for (const severity of ["low", "moderate"]) {
    for (const now of ["2026-07-27T00:00:00Z", "2026-08-11T00:00:00Z"]) {
      await t.test(`${severity} at ${now}`, () => {
        const audit = structuredClone(acceptedAudit);
        audit.vulnerabilities["react-router"].severity = severity;
        audit.vulnerabilities["react-router"].via[0].severity = severity;
        audit.vulnerabilities["react-router-dom"].severity = severity;
        audit.metadata.vulnerabilities.high = 0;
        audit.metadata.vulnerabilities[severity] = 2;

        assert.throws(
          () =>
            evaluateAudit({
              audit,
              allowlist,
              now: new Date(now),
            }),
          /npm audit returned an unsupported response/,
        );
      });
    }
  }
});

test("rejects contradictory advisory identity fields", () => {
  const audit = structuredClone(acceptedAudit);
  audit.vulnerabilities["react-router"].via[0].name = "other-package";

  assert.throws(
    () =>
      evaluateAudit({
        audit,
        allowlist,
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    /npm audit returned an unsupported response/,
  );
});

test("rejects unsupported report versions and contradictory package names", async (t) => {
  const mutations = [
    ["report version", (audit) => (audit.auditReportVersion = 3)],
    [
      "package name",
      (audit) => (audit.vulnerabilities["react-router"].name = "other-package"),
    ],
  ];

  for (const [name, mutate] of mutations) {
    await t.test(name, () => {
      const audit = structuredClone(acceptedAudit);
      mutate(audit);

      assert.throws(
        () =>
          evaluateAudit({
            audit,
            allowlist,
            now: new Date("2026-07-27T00:00:00Z"),
          }),
        /npm audit returned (?:an unsupported response|inconsistent vulnerability metadata)/,
      );
    });
  }
});

test("rejects an npm audit response carrying an error", () => {
  assert.throws(
    () =>
      evaluateAudit({
        audit: { ...acceptedAudit, error: { code: "EAUDIT" } },
        allowlist,
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    /npm audit returned an error response/,
  );
});

test("rejects an allowlisted advisory after expiration", () => {
  assert.throws(
    () =>
      evaluateAudit({
        audit: acceptedAudit,
        allowlist,
        now: new Date("2026-08-11T00:00:00Z"),
      }),
    /expired on 2026-08-10/,
  );
});

test("rejects a different high advisory", () => {
  const audit = structuredClone(acceptedAudit);
  audit.vulnerabilities["react-router"].via[0].url =
    "https://github.com/advisories/GHSA-xxxx-yyyy-zzzz";

  assert.throws(
    () =>
      evaluateAudit({
        audit,
        allowlist,
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    /Audit causes do not match the approved package relationship/,
  );
});

test("rejects an additional unrecognized advisory object", () => {
  const audit = structuredClone(acceptedAudit);
  audit.vulnerabilities["react-router"].via.push({
    url: "https://example.invalid/CVE-2099-0001",
    severity: "high",
  });

  assert.throws(
    () =>
      evaluateAudit({
        audit,
        allowlist,
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    /Audit advisory object is not a canonical GHSA/,
  );
});

test("rejects missing, empty, or non-array audit causes", async (t) => {
  const invalidValues = [undefined, [], { unexpected: true }];

  for (const value of invalidValues) {
    await t.test(JSON.stringify(value), () => {
      const audit = structuredClone(acceptedAudit);
      audit.vulnerabilities["react-router"].via = value;

      assert.throws(
        () =>
          evaluateAudit({
            audit,
            allowlist,
            now: new Date("2026-07-27T00:00:00Z"),
          }),
        /Audit causes must be a non-empty array/,
      );
    });
  }
});

test("rejects advisory objects with a missing or malformed URL", async (t) => {
  const invalidUrls = [undefined, "GHSA-qwww-vcr4-c8h2"];

  for (const url of invalidUrls) {
    await t.test(String(url), () => {
      const audit = structuredClone(acceptedAudit);
      audit.vulnerabilities["react-router"].via[0].url = url;

      assert.throws(
        () =>
          evaluateAudit({
            audit,
            allowlist,
            now: new Date("2026-07-27T00:00:00Z"),
          }),
        /Audit advisory object is not a canonical GHSA/,
      );
    });
  }
});

test("rejects an advisory object without high severity", () => {
  const audit = structuredClone(acceptedAudit);
  delete audit.vulnerabilities["react-router"].via[0].severity;

  assert.throws(
    () =>
      evaluateAudit({
        audit,
        allowlist,
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    /Audit advisory object must have high severity/,
  );
});

test("rejects allowed causes assigned to the wrong packages", () => {
  const audit = structuredClone(acceptedAudit);
  audit.vulnerabilities["react-router"].via = ["react-router"];
  audit.vulnerabilities["react-router-dom"].via = [
    {
      name: "react-router-dom",
      dependency: "react-router-dom",
      url: "https://github.com/advisories/GHSA-qwww-vcr4-c8h2",
      severity: "high",
    },
  ];

  assert.throws(
    () =>
      evaluateAudit({
        audit,
        allowlist,
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    /Audit causes do not match the approved package relationship/,
  );
});

test("never accepts a critical vulnerability", () => {
  const audit = structuredClone(acceptedAudit);
  audit.vulnerabilities["react-router"].severity = "critical";
  audit.metadata.vulnerabilities.high = 1;
  audit.metadata.vulnerabilities.critical = 1;

  assert.throws(
    () =>
      evaluateAudit({
        audit,
        allowlist,
        now: new Date("2026-07-27T00:00:00Z"),
      }),
    /Critical vulnerabilities cannot be allowlisted/,
  );
});

test("keeps the accepted-risk scope free of RSC and Server Actions", () => {
  const projectDirectory = resolve(TEST_DIRECTORY, "../../..");
  const excludedFiles = new Set([
    resolve(TEST_DIRECTORY, "audit-security.test.mjs"),
  ]);

  assert.deepEqual(findRscUsage(projectDirectory, excludedFiles), []);
});

test("detects RSC in executable scripts and environment files", (t) => {
  const projectDirectory = mkdtempSync(resolve(tmpdir(), "euchef-rsc-scan-"));
  const frontendDirectory = resolve(projectDirectory, "frontend");
  const scriptsDirectory = resolve(frontendDirectory, "scripts");
  const scriptPath = resolve(scriptsDirectory, "enable-server-components.mjs");
  const extensionlessScriptPath = resolve(scriptsDirectory, "start-rsc");
  const environmentPath = resolve(projectDirectory, ".env.production");
  const dockerfilePath = resolve(frontendDirectory, "Dockerfile");
  const composePath = resolve(projectDirectory, "compose.yaml");
  mkdirSync(scriptsDirectory, { recursive: true });
  writeFileSync(scriptPath, 'import "react-server-dom-webpack/server";\n');
  writeFileSync(
    extensionlessScriptPath,
    "node --conditions=react-server app.mjs\n",
  );
  writeFileSync(environmentPath, "VITE_RUNTIME=react-server\n");
  writeFileSync(dockerfilePath, "ENV VITE_RUNTIME=react-server\n");
  writeFileSync(
    composePath,
    "services:\n  frontend:\n    environment:\n      VITE_RUNTIME: react-server\n",
  );
  t.after(() => rmSync(projectDirectory, { recursive: true, force: true }));

  assert.deepEqual(
    new Set(findRscUsage(projectDirectory)),
    new Set([
      scriptPath,
      extensionlessScriptPath,
      environmentPath,
      dockerfilePath,
      composePath,
    ]),
  );
});
