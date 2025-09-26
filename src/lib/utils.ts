import { parse } from "csv-parse/sync";
import fs from "fs/promises";
import { type } from "arktype";

export async function parseCSVFile(filePath: string): Promise<any[]> {
  const content = await fs.readFile(filePath, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

export function transformToMetafields(
  row: Record<string, string>,
  productId: number
) {
  const skipColumns = ["id", "sku"];
  const sku = row.sku || `product_${productId}`;

  const header = type.string.narrow((s) => !skipColumns.includes(s));
  const value = type("string.trim.preformatted").moreThanLength(0);
  const columnSchema = type([header, value]);

  return Object.entries(row)
    .filter(columnSchema.allows)
    .map(([key, value]) => {
      const [namespace, ...rest] = key.split(".");
      const metafieldKey = rest.join(".");

      const formattedKey = metafieldKey
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      return {
        resource_type: "product",
        resource_id: productId,
        namespace,
        key: metafieldKey,
        value,
        description: `${formattedKey} for ${sku}`,
        permission_set: "write_and_sf_access",
      } as const;
    });
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
