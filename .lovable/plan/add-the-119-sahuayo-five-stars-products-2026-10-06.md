# Add the 119 Sahuayo / Five Stars products

## What I checked
- The file uses 12 categories: Aceite, Atún y Sardinas, Conservas, Desechables, Higiénicos y Servitoallas, Lácteos, Papel Aluminio, Pañales, Sal, Semillas, Sustituto de Crema, Veladoras.
- **All 12 already exist exactly once** in your product categories. No duplicates exist today, and none will be created: the file links products to the existing category with the same name (case and spaces ignored).
- None of these product codes (SKUs) exist yet, so all 119 will be added as new products.

## What will happen
1. Category step: finds all 12 categories already there, so it adds none.
2. Adds 119 products: name, description, brand, category, price (sample values in Mexican pesos), GST 0%, weight/volume, active.
3. Units for each product: PIECE as the base / selling / pricing unit, and BOX = the pack count from the catalogue (e.g. 20 pieces per box).
4. Afterwards I re-check: 119 products found and active, every product has 2 units, and each category name still appears only once.

## Technical details
- Run the uploaded SQL unchanged as a data change (data change tool), since it only inserts/updates rows.
- Safe to re-run: products are matched on SKU; categories matched on `lower(trim(name))`.
- No app code or table structure changes.
- Note: prices are sample values per the file; replace with real prices later if needed.
