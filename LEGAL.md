# BOT-KLB — LEGAL COMPLIANCE & SECURITY REMEDIATION

## Mission

Perform an evidence-based legal compliance and security remediation audit of the entire repository.

The objective is to reduce legal, contractual, privacy, intellectual property, and platform-policy exposure without unnecessarily removing legitimate product functionality.

## Mandatory Rules

1. Never invent legal requirements, platform policies, API permissions, or technical behavior.
2. Verify every finding against actual source code and authoritative primary sources.
3. Distinguish CONFIRMED, POTENTIAL, UNVERIFIED, and FALSE_POSITIVE findings.
4. Do not interpret a Terms of Service violation as automatically constituting a criminal or civil offense.
5. Do not bypass, evade, conceal, or circumvent third-party security mechanisms, access controls, or enforcement systems.
6. Do not claim that disclaimers, consent, encryption, or open-source licenses eliminate legal liability.
7. Do not remove product features without establishing the actual risk and evaluating compliant alternatives.

## Phase 1 — Source Code Remediation

Audit and remediate:

- Authentication and credential handling.
- Browser extension permissions and host access.
- XHR/Fetch interception and message bridges.
- Garena redemption automation.
- Delta Force API integration.
- SQLite and MongoDB data retention.
- Credential revocation and permanent deletion.
- Payment and donation data processing.
- External service integrations.
- Logging, telemetry, secrets, and error reporting.

Prioritize:

- No raw credentials in logs.
- No unnecessary credential collection.
- Least-privilege extension permissions.
- No unauthorized automation or circumvention.
- Accurate deletion and retention behavior.
- Secure third-party data transfers.

## Phase 2 — Legal Documentation

Review and update:

- PRIVACY.md
- TERMS.md
- README.md

Create or evaluate:

- LICENSE
- SECURITY.md
- THIRD_PARTY_NOTICES.md
- ASSET_LICENSES.md
- CONTRIBUTING.md
- CODE_OF_CONDUCT.md

Do not automatically apply MIT, AGPL, or another open-source license.

First determine the intended ownership and redistribution model. Separate original source code from third-party assets and dependencies.

## Phase 3 — Policy Verification

Use authoritative sources only:

- Discord Terms of Service.
- Discord Developer Policy.
- Discord Developer Terms.
- Applicable Garena Terms.
- Applicable Delta Force EULA.
- Vietnamese Law No. 91/2025/QH15.
- Applicable intellectual property legislation.

Verify jurisdiction, applicable service, effective date, exact clause, and scope.

If a policy cannot be verified, mark it UNVERIFIED.

## Phase 4 — Acceptance Criteria

The remediation is not complete until:

1. Privacy Policy accurately reflects actual data processing.
2. Terms do not make unsupported legal or technical promises.
3. Unlink, revoke, and deletion behavior are clearly distinguished.
4. Credential leakage paths are eliminated.
5. Third-party integrations and data recipients are documented.
6. Extension permissions are justified individually.
7. Original and third-party intellectual property are properly attributed and licensed.
8. Security vulnerability reporting is documented.
9. Existing functionality is preserved where compliant.
10. TypeScript checks, tests, and relevant security tests pass.

## Required Deliverables

Create:

- LEGAL-COMPLIANCE-AUDIT.md
- SECURITY-AUDIT.md
- REMEDIATION-REPORT.md
- Updated legal documentation.

Every finding must contain:

Finding ID, severity, status, exact file and line, actual evidence, applicable rule, official source, applicability analysis, recommended remediation, and verification result.

Do not claim legal compliance merely because documentation has been added.

Do not mark any issue resolved without testing the actual implementation.

Finish with a list of unresolved risks requiring confirmation from the relevant platform owner or qualified legal counsel.
