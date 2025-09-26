import { Management } from "@aligent/bigcommerce-api";
import { Command } from "commander";
import { initializeClient, getStoreInfo } from "../lib/client.js";
import { chunk } from "../lib/utils.js";
import type { DeleteOptions } from "../lib/types.js";
import { type } from "arktype";

const productMetafieldSchema = type({
  id: "number",
  resource_id: "number",
  key: "string",
  namespace: "string",
  value: "string",
});

type ProductMetafield = typeof productMetafieldSchema.infer;

const program = new Command();

program
  .name("delete-metafields")
  .description("Delete metafields from BigCommerce by various criteria")
  .version("1.0.0")
  .option("-a, --access-token <token>", "BigCommerce API access token")
  .option("-s, --store-hash <hash>", "BigCommerce store hash")
  .option(
    "--dry-run <boolean>",
    "Preview what would be deleted without making API calls (default: true)",
    (value) => {
      if (value === "false" || value === "0" || value === "no") {
        return false;
      }
      return true;
    },
    true
  )
  .option(
    "-k, --key <keys...>",
    "Delete metafields by key (can specify multiple)"
  )
  .option(
    "-n, --namespace <namespaces...>",
    "Delete metafields by namespace (can specify multiple)"
  )
  .option(
    "-p, --product-id <ids...>",
    "Delete metafields by product ID (can specify multiple)",
    (value, previous: number[] | undefined) => {
      const parsed = parseInt(value);
      if (isNaN(parsed)) {
        console.error(`Invalid product ID: ${value}`);
        process.exit(1);
      }
      return previous ? [...previous, parsed] : [parsed];
    }
  )
  .option(
    "--batch-size <number>",
    "Batch size for metafield deletion",
    parseInt,
    50
  )
  .option(
    "--limit <number>",
    "Limit number of metafields to fetch (for testing)",
    parseInt
  )
  .parse();

const options = program.opts() as DeleteOptions;

if (options.dryRun === undefined) {
  options.dryRun = true;
}

if (!options.dryRun && (!options.accessToken || !options.storeHash)) {
  console.error(
    "Error: Both --access-token and --store-hash are required unless using --dry-run mode"
  );
  process.exit(1);
}

if (!options.key && !options.namespace && !options.productId) {
  console.error(
    "Error: You must specify at least one deletion criteria: --key, --namespace, --product-id"
  );
  console.error("\nExamples:");
  console.error("  Delete by key: --key short_description_mf");
  console.error("  Delete by namespace: --namespace custom");
  console.error("  Delete by product: --product-id 123 456");
  process.exit(1);
}

async function fetchMetafields(
  client: Management.Client,
  options: DeleteOptions
) {
  const query: any = {};

  if (options.key) {
    query["key:in"] = options.key;
  }

  if (options.namespace) {
    query["namespace:in"] = options.namespace;
  }

  if (options.productId) {
    query["resource_id:in"] = options.productId;
  }

  query.include_fields = ["id", "key", "namespace", "resource_id", "value"];
  query.limit = 250;

  try {
    const iterator = client.v3.list("/catalog/products/metafields", {
      query,
    });

    const items = [];
    for await (const item of iterator) {
      if (items.length % 50 === 0) {
        console.log(`Fetched ${items.length} metafields...`);
      }

      items.push(item);

      if (items.length >= (options.limit || Infinity)) {
        break;
      }
    }

    if (!items.length) {
      console.log("No metafields found");
      process.exit(0);
    }

    return items.filter(productMetafieldSchema.allows);
  } catch (error: any) {
    console.error("Error fetching metafields:", error.message);
    process.exit(1);
  }
}

async function deleteMetafields(
  client: Management.Client,
  metafields: ProductMetafield[],
  batchSize: number
): Promise<{ success: number; failed: number }> {
  const batches = chunk(metafields, batchSize);
  let success = 0;
  let failed = 0;

  for (const [index, batch] of batches.entries()) {
    console.log(
      `\nDeleting batch ${index + 1}/${batches.length} (${
        batch.length
      } metafields)...`
    );

    try {
      await client.v3.delete("/catalog/products/metafields", {
        body: batch.map((metafield) => metafield.id),
      });

      success += batch.length;
      console.log(`  ✓ Deleted ${batch.length} metafields`);
    } catch (error: any) {
      failed += batch.length;
      console.error(`  ✗ Error deleting batch:`, error.message);
    }
  }

  return { success, failed };
}

async function main() {
  try {
    let client: Management.Client | undefined;
    let storeInfo: any = null;

    if (options.accessToken && options.storeHash) {
      client = initializeClient(options.accessToken!, options.storeHash!);
      storeInfo = await getStoreInfo(client);
    }

    if (options.dryRun) {
      console.log("🔍 Running in dry-run mode - no API calls will be made\n");
    } else if (!client) {
      console.log("No credentials provided - running in read-only mode\n");
      process.exit(1);
    }

    if (storeInfo) {
      console.log("🏪 Store Details:");
      console.log(`   Name: ${storeInfo.name}`);
      console.log(`   URL: ${storeInfo.domain}`);
      console.log(`   Store Hash: ${options.storeHash}\n`);
    }

    console.log("🔎 Search Criteria:");
    if (options.key) console.log(`   Keys: ${options.key.join(", ")}`);
    if (options.namespace)
      console.log(`   Namespaces: ${options.namespace.join(", ")}`);
    if (options.productId)
      console.log(`   Product IDs: ${options.productId.join(", ")}`);

    if (options.limit) {
      console.log(`   Limit: ${options.limit} metafields`);
    }

    if (!client) {
      console.log("\n⚠️  Cannot proceed without BigCommerce credentials");
      process.exit(1);
    }

    console.log("\n📊 Fetching metafields...");
    const metafields = await fetchMetafields(client, options);

    if (metafields.length === 0) {
      console.log("\n✅ No metafields found matching the criteria");
      return;
    }

    console.log(`\nFound ${metafields.length} metafields to delete`);

    if (options.dryRun) {
      console.log("\n📋 Sample of metafields that would be deleted:");
      console.log("-".repeat(50));

      const sample = metafields.slice(0, 5);
      sample.forEach((mf, index) => {
        console.log(
          `\n${index + 1}. Product ${mf.resource_id}: ${mf.namespace}.${mf.key}`
        );
        if (mf.value) {
          console.log(
            `   Value: ${mf.value.substring(0, 50)}${
              mf.value.length > 50 ? "..." : ""
            }`
          );
        }
      });

      if (metafields.length > 5) {
        console.log(`\n... and ${metafields.length - 5} more metafields`);
      }

      console.log("\n" + "=".repeat(50));
      console.log(
        "\n⚠️  This is a dry run. To actually delete, run with --dry-run=false"
      );
    } else {
      const batchSize = options.batchSize || 50;
      console.log(
        `\n🗑️  Deleting ${metafields.length} metafields in batches of ${batchSize}...`
      );

      const { success, failed } = await deleteMetafields(
        client,
        metafields,
        batchSize
      );

      console.log("\n" + "=".repeat(50));
      console.log("\n=== Summary ===");
      console.log(`Total metafields found: ${metafields.length}`);
      console.log(`Successfully deleted: ${success}`);
      if (failed > 0) {
        console.log(`Failed to delete: ${failed}`);
      }

      if (success > 0) {
        console.log(
          "\n✅ Metafields have been deleted from BigCommerce successfully!"
        );
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
