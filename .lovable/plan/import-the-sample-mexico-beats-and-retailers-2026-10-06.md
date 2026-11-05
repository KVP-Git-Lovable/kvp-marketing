# Import the sample Mexico beats and retailers

Run the uploaded script with two changes. Nothing in the app itself changes.

## What will be added
- **Owner:** Dharmesh (contractor123@yahoo.in) owns all the beats and retailers.
- **Distributor:** a basic "Sahuayo" distributor is created first, because none exists yet. It gets the name only, with no contact details.
- **5 beats:** CDMX Centro Histórico, CDMX Roma - Condesa, CDMX Coyoacán, CDMX Iztapalapa, Tlalnepantla.
- **10 retailers:** 2 per beat, each with its address, phone, type, category and map location, and each linked to Sahuayo. They are kept out of Zoho sync.

None of these beats or retailers exist yet, so nothing gets duplicated. The script is safe to run again.

## Check afterwards
Confirm there are 5 beats with 2 retailers each, and that every retailer has a map location and is linked to Sahuayo.

## Technical details
- Set `v_owner_email` to `contractor123@yahoo.in`.
- Before the retailer insert, add a Sahuayo row to `distributors` only if no distributor has that name. Check the table's required columns first.
- Run it as a data change, then run the script's own result query.
