#!/usr/bin/env node

/**
 * Initialize server.config.yml from template
 * Copies server.config.dev.yml to server.config.yml if it doesn't exist
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const devConfigPath = path.join(root, "server.config.dev.yml");
const prodConfigPath = path.join(root, "server.config.yml");
const prodConfigYamlPath = path.join(root, "server.config.yaml");

// Check if server.config.yml or .yaml already exists
if (fs.existsSync(prodConfigPath)) {
  console.log("✓ server.config.yml already exists");
  process.exit(0);
}
if (fs.existsSync(prodConfigYamlPath)) {
  console.log("✓ server.config.yaml already exists");
  process.exit(0);
}

// Check if template exists
if (!fs.existsSync(devConfigPath)) {
  console.error("✗ Template not found: server.config.dev.yml");
  process.exit(1);
}

// Copy template to production config
try {
  fs.copyFileSync(devConfigPath, prodConfigPath);
  console.log("✓ Created server.config.yml from template");
} catch (error) {
  console.error("✗ Failed to create server.config.yml:", error.message);
  process.exit(1);
}
