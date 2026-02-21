/**
 * Universal Import Hub — Schema Barrel
 *
 * Import all schema modules so they self-register via registerSchema().
 * This file is dynamically imported by ensureSchemasLoaded() in the registry.
 */

import "./aircraft";
import "./aircraft-models";
import "./aircraft-type-mappings";
import "./app-config";
import "./customers";
import "./engine-types";
import "./manufacturers";
import "./users";
import "./work-packages";

// Capacity schemas
import "./capacity-shifts";
import "./headcount-plans";
import "./headcount-exceptions";
import "./rotation-patterns";
import "./rotation-presets";
import "./staffing-shifts";
