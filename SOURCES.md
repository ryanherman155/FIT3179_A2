# Source register — Becoming Australia

This register maps every `source_id` in the CSV files, plus the geography and other assets, to its original publisher. The CSVs in `data/` were prepared before this implementation; **the original research workbooks are not in this repository**, so the mapping below was reconstructed from the `source_id` codes and checked against the publishers where noted. Items marked **VERIFY** must be confirmed by the author against the original publication before submission.

## Statistical data

| `source_id` | Used in | Publisher / title | URL | Status |
|---|---|---|---|---|
| `ABS_HIST_1911_1986` | 01, 02 | Australian Bureau of Statistics. Census of Population and Housing, historical national counts 1911–1986 (as published in ABS historical Census publications / Year Books). | https://www.abs.gov.au/census/find-census-data/historical | 1911, 1966 and the 1961→1966 increase (1,042,276) cross-checked against secondary sources. 1976 differs by 2 persons from one secondary source (13,548,450 vs 13,548,448). **VERIFY exact table.** |
| `ABS_HIST_1991` | 01, 02 | ABS. 1991 Census of Population and Housing, national count. | https://www.abs.gov.au/census/find-census-data/historical | **VERIFY table and count basis** (place of enumeration vs usual residence). |
| `ABS_QS_2001_AUS` | 01, 02 | ABS. 2001 Census QuickStats: Australia. | https://www.abs.gov.au/census/find-census-data/quickstats/2001/0 | Value matches the published Australia total. |
| `ABS_QS_2006_AUS` | 01, 02 | ABS. 2006 Census QuickStats: Australia. | https://www.abs.gov.au/census/find-census-data/quickstats/2006/0 | Value matches the published Australia total. |
| `ABS_QS_2011_AUS` | 01, 02, 08 | ABS. 2011 Census QuickStats: Australia (total and age groups). | https://www.abs.gov.au/census/find-census-data/quickstats/2011/0 | Age-group counts sum to 21,507,719, 2 more than the total (ABS perturbs small cells; expected). |
| `ABS_LOC` | 01, 02, 03, 04, 06 | ABS. *Location: Census*, 2021 — state and territory Census counts, 2016 and 2021. | https://www.abs.gov.au/statistics/people/people-and-communities/location-census/2021 | State totals are internally consistent; the gap to the national total equals Other Territories (4,779 in 2021; 4,589 in 2016). |
| `ABS_QS_2021_AUS` | 01, 02, 08, 09, 10 | ABS. 2021 Census QuickStats: Australia (total, age, country of birth incl. 2016 comparison). | https://www.abs.gov.au/census/find-census-data/quickstats/2021/AUS | 2021 total 25,422,788 matches. |
| `ABS_QS_2021_NSW` … `ABS_QS_2021_ACT` | 05 | ABS. 2021 Census QuickStats for each state and territory (country of birth, "Australia", 2016 and 2021 columns). | https://www.abs.gov.au/census/find-census-data/quickstats/2021/1 (NSW) … /2021/8 (ACT) | Published percentages agree with count ÷ population to within rounding (max difference 0.05 pp). |
| `AIFS_PHH` | 07, 11, 12 | Australian Institute of Family Studies (2023, July). *Population, households and families* (Facts and Figures). Draws on ABS Censuses and Hugo (2002). | https://aifs.gov.au/all-research/facts-and-figures/population-households-and-families | Household size 4.5 (1911), 3.6 (1961), ~2.6 (2001), 2.5 (2021) and one-person households 26% (2021) confirmed via search of the AIFS page. 0–14 share 35% (1911) → 17% (2021) confirmed. **65+ share 4% (1911) and 17% (2021) not yet confirmed — VERIFY against the AIFS figure.** |

Two independent publishers are combined: **ABS** (Census counts, geography) and **AIFS** (historical age-structure and household summaries), which satisfies the "combine data from two different sources" requirement. AIFS draws on ABS Censuses, so mention this when you describe the data.

## Geography

| File | Source | Licence | Processing |
|---|---|---|---|
| `geo/aus_states_2021.topo.json` | ABS, Australian Statistical Geography Standard (ASGS) Edition 3, State and Territory (STE) 2021, downloaded from the ABS ArcGIS REST service `geo.abs.gov.au/arcgis/rest/services/ASGS2021/STE/MapServer/0` (server-generalised to ~0.02°), with the official `area_albers_sqkm` attribute. | © Commonwealth of Australia (ABS), CC BY 4.0 | Kept state codes 1–8 (dropped Other Territories and the non-spatial codes); removed islands under 40 km²; simplified with mapshaper (Visvalingam, 30% retained, shapes kept); converted to TopoJSON (quantisation 1e5); 40 KB. |
| `geo/state_label_points.csv` | Derived from the same ABS geometry: an interior ("inner") point for each state computed with mapshaper `-points inner`. `label_longitude/latitude` are hand-set label offsets for the ACT, VIC and TAS labels (cartographic placement only, not data). | as above | — |

Download page for the full-resolution boundaries: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files

## Software, fonts and other assets

| Asset | Source | Licence |
|---|---|---|
| Vega 5.30.0, Vega-Lite 5.21.0, Vega-Embed 6.26.0 | https://vega.github.io (via cdn.jsdelivr.net) | BSD-3-Clause |
| Playfair Display, DM Sans, DM Mono | Google Fonts | SIL Open Font License 1.1 |
| Person pictogram (chart 11) | Drawn for this project as an SVG path inside `vis/11.json` | Original |
| Visual direction | `reference/australia_census_story_prototype.html` (author's own earlier prototype) | — |

No third-party chart graphics, images or icons are used.
