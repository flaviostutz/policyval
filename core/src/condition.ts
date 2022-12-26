/*
 * Conditions as in https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
 */

import { ConditionEvaluator } from './types/ConditionEvaluator';
import {
  StringEquals,
  StringEqualsIgnoreCase,
  StringLike,
  StringNotEquals,
  StringNotEqualsIgnoreCase,
  StringNotLike,
} from './conditions/string';
import { RequestContext } from './types/RequestContext';
import { ConditionInput } from './types/ConditionInput';
import { resolveVar } from './conditions/resolver';

const evaluators = new Map<string, ConditionEvaluator>();

// register condition evaluators
evaluators.set(StringEquals.name(), StringEquals);
evaluators.set(StringNotEquals.name(), StringNotEquals);
evaluators.set(StringEqualsIgnoreCase.name(), StringEqualsIgnoreCase);
evaluators.set(StringNotEqualsIgnoreCase.name(), StringNotEqualsIgnoreCase);
evaluators.set(StringLike.name(), StringLike);
evaluators.set(StringNotLike.name(), StringNotLike);

const evaluateConditions = (
  context: RequestContext,
  condition?: Record<string, ConditionInput>,
): boolean => {
  for (const opn in condition) {
    if (!Object.prototype.hasOwnProperty.call(condition, opn)) {
      continue;
    }

    let operatorName = opn;
    let ifExists = false;
    if (opn.endsWith('IfExists')) {
      operatorName = opn.substring(0, opn.indexOf('IfExists'));
      ifExists = true;
    }

    const evaluator = evaluators.get(operatorName);
    if (!evaluator) {
      throw new Error(`Condition evaluator for '${operatorName}' doesn't exist`);
    }

    const input = condition[opn];
    for (const key in input) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) {
        continue;
      }

      const value = input[key];

      if (Array.isArray(value)) {
        let okOr = false;
        for (let i = 0; i < value.length; i += 1) {
          const varValue = resolveVar(context, key);
          let ok = false;
          if (varValue === null) {
            ok = ifExists;
          } else {
            ok = evaluator.evaluate(varValue, value[i]);
          }
          if (ok) {
            okOr = true;
          }
        }
        if (!okOr) {
          return false;
        }
      } else {
        if (typeof value !== 'string') {
          return false;
        }
        const varValue = resolveVar(context, key);
        let ok = false;
        if (varValue === null) {
          ok = ifExists;
        } else {
          ok = evaluator.evaluate(varValue, value);
        }
        if (!ok) {
          return false;
        }
      }
    }
  }
  return true;
};

const conditionExists = (name: string): boolean => {
  let cname = name;
  if (name.endsWith('IfExists')) {
    cname = name.substring(0, name.indexOf('IfExists'));
  }
  return evaluators.has(cname);
};

export { conditionExists, evaluateConditions };