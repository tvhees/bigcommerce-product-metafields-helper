export interface ProgramOptions {
  accessToken?: string;
  storeHash?: string;
  dryRun?: boolean;
  skip?: number;
  limit?: number;
  batchSize?: number;
}

export interface DeleteOptions extends ProgramOptions {
  key?: string[];
  namespace?: string[];
  productId?: number[];
  all?: boolean;
}
