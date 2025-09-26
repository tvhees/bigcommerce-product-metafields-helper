import { Management } from "@aligent/bigcommerce-api";

export function initializeClient(accessToken: string, storeHash: string): Management.Client {
  return new Management.Client({
    accessToken,
    storeHash,
  });
}

export async function getStoreInfo(client: Management.Client) {
  try {
    const storeInfo = await client.v2.get("/store");
    return storeInfo;
  } catch (error) {
    console.warn("Could not fetch store information");
    return null;
  }
}