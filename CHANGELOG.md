## 1.4.1 - 2023-11-22

- Fix: Invoke and clear *observer exit* callbacks before re-evaluating observed script

## 1.4.0 - 2023-11-20

- New feature: `ScriptFunctionScope.onObserverExit` and `ScriptEvalOptions.onObserverExit`

## 1.3.0 - 2023-10-19

- New feature: `ScriptFunctionScope.onScriptExit`

## 1.2.1 - 2023-06-02

- Fix: Unwrap error message in function call error response

## 1.2.0 - 2023-05-22

- New feature: Read-only globals
- New feature: `key` in `ScriptFunctionScope`

## 1.1.0 - 2022-09-29

- New feature: Allow explicit invalidation of all active observations: `ScriptHost.invalidateAllObservations()`
- New feature: Allow replacement of exposed script functions: `ScriptHost.replaceFuncs(...)`

## 1.0.1 - 2022-09-29

- Fix: Track vars in all non-idempotent evals

## 1.0.0 - 2022-05-04

The first non-preview/development release.
