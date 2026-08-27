# QAE Test Cases - Kitchen Production Workflows

These test cases describe how QAE validates Recipe Management and Production Batch Control from a kitchen-user point of view.

## Recipe Management

### RM-01 Select A Menu Item

Precondition: user has company, branch, and recipe permissions.

Steps:

1. Open Recipe Management.
2. Select a menu item.
3. Confirm the selected item appears as the current recipe context.

Expected:

- The kitchen user can tell which item is being configured.
- The page explains the next step without needing ERP knowledge.
- Save remains disabled or validation explains missing requirements.

### RM-02 Configure Direct-Sale Recipe

Steps:

1. Select Direct Sale / Made-to-Order.
2. Add one ingredient.
3. Select recipe/consume UOM.
4. Enter quantity and waste percent.
5. Save recipe.

Expected:

- Ingredient line is easy to complete.
- Validation explains missing ingredient, UOM, or invalid quantity.
- Success message is visible after save.
- Production batch action is unavailable for direct-sale recipes.

### RM-03 Configure Production Recipe

Steps:

1. Select Production / Stocked Output.
2. Select output item and output UOM.
3. Add ingredient lines.
4. Save recipe.

Expected:

- Output setup is visually separated from ingredients.
- User understands what will be produced and what will be consumed.
- Create Production Batch becomes available only after a valid saved production recipe.

### RM-04 Costing Visibility

Steps:

1. Open a saved recipe.
2. Review costing panel.

Expected:

- Cost impact is visible without leaving the recipe screen.
- Missing costing data is shown as an actionable warning.

## Production Batch Control

### PB-01 Create Batch From Recipe

Steps:

1. Open Production Batch Control from a production recipe.
2. Confirm menu item and recipe context.
3. Select issue and output locations.
4. Enter planned quantity.
5. Create batch.

Expected:

- Kitchen user understands where ingredients come from and where output goes.
- Create Batch is blocked until recipe, menu item, locations, and planned quantity are valid.

### PB-02 Apply Recipe

Steps:

1. Create or open a draft batch.
2. Click Apply Recipe.

Expected:

- Input lines are generated from recipe.
- Total input quantity is visible.
- Manual changes remain possible only while the batch is editable.

### PB-03 Save Input Adjustments

Steps:

1. Adjust input quantities or add manual line.
2. Save inputs.

Expected:

- Every line requires item, UOM, and quantity.
- Invalid lines produce a clear error.
- Saved lines reload without losing context.

### PB-04 Post Batch

Steps:

1. Apply recipe and verify input lines.
2. Post batch.

Expected:

- Posting is available only for draft batches with input lines.
- Posted batch becomes non-editable.
- Status changes to Posted and posting timestamp is visible.

### PB-05 Reverse Posted Batch

Steps:

1. Open a posted batch.
2. Reverse the batch.

Expected:

- Confirmation is required.
- Reverse is available only for posted batches.
- Reversed status is clear.

## Automation Candidates

- Recipe page loads with mocked menu item, inventory items, UOMs, and recipe response.
- Production recipe mode shows output setup and blocks saving without output item/UOM.
- Production batch page loads mocked catalogs and blocks Create Batch when required fields are missing.
- POS-to-production regression: production batch route remains reachable after shell/sidebar changes.
