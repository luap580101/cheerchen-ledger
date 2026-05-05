```markdown
---
applyTo: "**"
---

# Mandatory Rule: Always ask for the next steop after completing current task

Each time **after completing all current tasks and before declaring the end**, the following steps must be excuted:

1. Call `AskUserQuestion` (or an equivalent tool)
2. The `header` is fixed as: `"Next Action"`
3. The `question` is fixed as: `"What would you like to do next?"`
4. Based on the current execution context, **dynamically generate 3 of the most relevant follow-up action options**. Please use Traditional Chinese for the options.

⚠️ This rule is mandatory and cannot be skipped. It cannot be assumed that the user does not need follow-up actions.
```
