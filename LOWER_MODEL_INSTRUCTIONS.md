# Lower-model instructions — next task

Use this as the prompt for a less capable coding model. Work in the project folder `C:\Users\abrah\Downloads\Invoice_Receipt_Maker_COMPLETE_FINAL\Invoice_Receipt_Maker_1.0.0-rc.1`.

## Objective

Complete Milestone 1 of `NEXT_PHASE_PLAN.md`: prove that this release candidate installs and passes its automated gates from a clean copy. Stop after Milestone 1 and report the result. Do not start the browser smoke check or change the release version in this task.

## Facts to preserve

- The app stores business, customer and financial data in browser storage. Do not read, replace or clear the user's active data.
- A local `npm run build` passed on 2026-09-23 after edits to `src/index.css`, `src/pages/Home/index.tsx` and `src/store/useStore.ts`. That does not prove a clean install.
- `RELEASE_CHECKLIST.md` is the release gate. Older status reports are historical and may not describe the current build.
- The extracted folder is not a Git repository. Do not run commands that require Git or claim a commit exists.

## Steps

1. Read `README.md`, `BUILD_AND_RELEASE.md`, `RELEASE_CHECKLIST.md` and `NEXT_PHASE_PLAN.md` before editing.
2. Make a disposable source copy as a sibling of the project inside the writable parent folder, not inside the project itself. Exclude `node_modules`, `dist`, logs and any user backup JSON. Keep any running app preview available.
3. In the clean copy, record `node --version` and `npm --version`, then run `npm ci`, `npm run release:check` and `npm run lint` in that order. Record each command's exit code and the relevant final output.
4. If a gate fails, identify the exact source or configuration cause. Make the smallest correction in the main project, carry it to the clean copy, and rerun the failed gate plus any gate affected by the change. Do not hide errors with `any`, skipped checks or changed audit thresholds.
5. Write `RELEASE_VERIFICATION_2026-09-23.md` in the main project. Include environment versions, clean-copy method, command results, fixes made, remaining browser/hosting gates and an explicit pass or blocked conclusion.
6. Update release status text only if the new report directly supports the statement. Leave unchecked browser and deployment checklist items unchecked.

## Boundaries

- Do not edit financial calculations, backup validation, payment/receipt lifecycle rules or PDF totals merely to make the audit pass. If one of those areas fails, document the reproduction and stop for review.
- Do not edit generated files in `node_modules` or `dist`.
- Do not deploy, publish, bump the version or create a release archive.
- Do not use real customer or business information as test data.

## Final report format

Return four short sections: **Automated gates**, **Files changed**, **Remaining gates**, and **Blockers**. Give exact commands and results. If all commands pass, say that only the automated gate is complete; the browser and hosting gates remain open.
