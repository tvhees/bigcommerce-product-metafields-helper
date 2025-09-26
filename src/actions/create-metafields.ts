import { Management } from "@aligent/bigcommerce-api";
import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { initializeClient, getStoreInfo } from "../lib/client.js";
import { parseCSVFile, transformToMetafields } from "../lib/utils.js";
import type { ProgramOptions } from "../lib/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "../../csv");

const program = new Command();

program
  .name("create-metafields")
  .description("Create metafields in BigCommerce from CSV files")
  .version("1.0.0")
  .option("-a, --access-token <token>", "BigCommerce API access token")
  .option("-s, --store-hash <hash>", "BigCommerce store hash")
  .option(
    "--dry-run <boolean>",
    "Read and process files without making API calls (default: true)",
    (value) => {
      if (value === "false" || value === "0" || value === "no") {
        return false;
      }
      return true;
    },
    true
  )
  .option(
    "--skip <number>",
    "Skip this many files before processing",
    parseInt,
    0
  )
  .option("--limit <number>", "Limit number of files to process", parseInt)
  .option(
    "--batch-size <number>",
    "Batch size for metafield creation",
    parseInt,
    50
  )
  .parse();

const options = program.opts() as ProgramOptions;

if (options.dryRun === undefined) {
  options.dryRun = true;
}

if (!options.dryRun && (!options.accessToken || !options.storeHash)) {
  console.error(
    "Error: Both --access-token and --store-hash are required unless using --dry-run mode"
  );
  process.exit(1);
}

async function readCSVFiles() {
  const files = await fs.readdir(dataDir);
  let csvFiles = files.filter((file) => file.endsWith(".csv")).sort();

  const skipCount = options.skip || 0;
  csvFiles = csvFiles.slice(
    skipCount,
    options.limit ? skipCount + options.limit : undefined
  );

  console.log(
    `Found ${files.filter((f) => f.endsWith(".csv")).length} CSV files`
  );

  const rangeText = [];
  if (options.skip) rangeText.push(`skipping first ${options.skip}`);
  if (options.limit) rangeText.push(`limiting to ${options.limit}`);

  console.log(
    `Processing ${csvFiles.length} files${
      rangeText.length > 0 ? ` (${rangeText.join(", ")})` : ""
    }`
  );

  let firstItem = null;

  if (csvFiles.length > 0) {
    const firstFile = csvFiles[0];
    console.log(`\nReading first file: ${firstFile}`);

    const filePath = path.join(dataDir, firstFile);
    const data = await parseCSVFile(filePath);

    if (data.length > 0) {
      firstItem = data[0];

      console.log(`\nFirst file statistics:`);
      console.log(`- Items in file: ${data.length}`);
      console.log(`- Columns found: ${Object.keys(data[0]).length}`);
      console.log(`- SKU: ${data[0].sku}`);
      console.log(`- Product ID: ${data[0].id}`);
    }
  }

  return { csvFiles, firstItem };
}

async function processAllFiles(client?: Management.Client) {
  const files = await fs.readdir(dataDir);
  let csvFiles = files.filter((file) => file.endsWith(".csv")).sort();

  const skipCount = options.skip || 0;
  csvFiles = csvFiles.slice(
    skipCount,
    options.limit ? skipCount + options.limit : undefined
  );

  console.log(`\nProcessing ${csvFiles.length} CSV files...`);

  let totalProducts = 0;
  let totalMetafields = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const [index, file] of csvFiles.entries()) {
    const actualIndex = (options.skip || 0) + index + 1;
    console.log(
      `\n[${actualIndex}/${
        (options.skip || 0) + csvFiles.length
      }] Processing ${file}...`
    );

    const filePath = path.join(dataDir, file);
    const data = await parseCSVFile(filePath);

    for (const row of data) {
      const productId = parseInt(row.id);
      if (!productId) continue;

      const metafields = transformToMetafields(row, productId);
      totalProducts++;
      totalMetafields += metafields.length;

      if (!options.dryRun && client && metafields.length > 0) {
        try {
          const batchSize = options.batchSize || 50;
          for (let i = 0; i < metafields.length; i += batchSize) {
            const batch = metafields.slice(i, i + batchSize);

            await client.v3.post("/catalog/products/metafields", {
              body: batch,
            });

            successCount += batch.length;
            console.log(
              `  ✓ Created ${batch.length} metafields for product ${productId} (${row.sku})`
            );
          }
        } catch (error: any) {
          errorCount++;
          console.error(
            `  ✗ Error for product ${productId} (${row.sku}):`,
            error.message
          );
        }
      } else if (options.dryRun) {
        console.log(
          `  [DRY RUN] Would create ${metafields.length} metafields for product ${productId} (${row.sku})`
        );
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total products processed: ${totalProducts}`);
  console.log(`Total metafields to create: ${totalMetafields}`);
  console.log(`Batch size: ${options.batchSize}`);

  if (!options.dryRun) {
    console.log(`Successfully created: ${successCount} metafields`);
    console.log(`Errors: ${errorCount}`);
  }
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
    }

    const sampleData = await readCSVFiles();

    await processAllFiles(client);

    console.log("\n" + "=".repeat(50));

    if (storeInfo) {
      console.log("\n🏪 Store Details:");
      console.log(`   Name: ${storeInfo.name}`);
      console.log(`   URL: ${storeInfo.domain}`);
      console.log(`   Store Hash: ${options.storeHash}`);
    } else if (options.accessToken && options.storeHash) {
      console.log(`\n🏪 Store Hash: ${options.storeHash}`);
    }

    if (options.dryRun && sampleData?.firstItem) {
      console.log("\n📋 Example metafields from first product:");
      console.log("-".repeat(50));

      const productId = parseInt(sampleData.firstItem.id) || 1;
      const metafields = transformToMetafields(sampleData.firstItem, productId);

      console.log(`Product: ${sampleData.firstItem.sku} (ID: ${productId})`);
      console.log(`Total metafields: ${metafields.length}`);

      if (metafields.length > 0) {
        console.log("\nFirst 3 metafields:");
        metafields.slice(0, 3).forEach((mf, index) => {
          console.log(`\n${index + 1}. ${mf.namespace}.${mf.key}`);
          console.log(
            `   Value: ${mf.value.substring(0, 50)}${
              mf.value.length > 50 ? "..." : ""
            }`
          );
          console.log(`   Description: ${mf.description}`);
        });

        if (metafields.length > 3) {
          console.log(`\n... and ${metafields.length - 3} more metafields`);
        }
      }
    }

    if (!options.dryRun && client) {
      console.log(
        "\n✅ Metafields have been pushed to BigCommerce successfully!"
      );
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
