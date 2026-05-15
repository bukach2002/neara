CREATE INDEX IF NOT EXISTS "tenants_name_trgm_idx" ON "tenants" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "tenants_description_trgm_idx" ON "tenants" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "services_name_trgm_idx" ON "services" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "locations_locality_trgm_idx" ON "locations" USING gin ("locality" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "locations_geography_idx"
  ON "locations"
  USING gist ((ST_MakePoint("longitude"::float8, "latitude"::float8)::geography));
