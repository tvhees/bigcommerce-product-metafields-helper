#!/usr/bin/env node

console.log(`
BigCommerce Product Metafield CLI
==================================

Available commands:

  yarn create         Create metafields from CSV files
  yarn delete         Delete metafields by various criteria

  yarn create:help    Show create command options
  yarn delete:help    Show delete command options

Examples:

  # Create metafields (dry run)
  yarn create --store-hash YOUR_HASH --access-token YOUR_TOKEN

  # Delete metafields by key
  yarn delete --key short_description_mf --store-hash YOUR_HASH --access-token YOUR_TOKEN

  # Show detailed help for each command
  yarn create:help
  yarn delete:help

For more information, see the README.md file.
`);