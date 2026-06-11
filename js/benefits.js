/**
 * benefits.js — 樹木生態效益估算
 *
 * 計算方式摘要（詳見 /tree.html 說明欄）：
 *   碳儲存：Brown (1997) 地上生物量公式 × IPCC (2006) 碳分率 0.47 × CO₂換算
 *   雨水截留：冠幅面積 × 台北年均雨量 2,400 mm × 截留係數 0.08（Xiao et al. 2000）
 *   空污效益：葉面積（冠幅×LAI 4.0）× 年均去除量 × 台灣 PM₂.₅ 健康成本
 *
 * 主要引用：
 *   Brown, S. (1997). FAO Forestry Paper 134.
 *   IPCC (2006). 2006 IPCC Guidelines, Chapter 4.
 *   Xiao, Q. et al. (2000). Urban Ecosystems 3: 65–86.
 *   Nowak, D.J. et al. (2014). Environmental Pollution 193: 119–127.
 */

// 木材密度（g/cm³）by 樹種，其餘預設 0.50（IPCC 熱帶闊葉樹）
const WOOD_DENSITY = {
  '樟樹': 0.52, '榕樹': 0.48, '茄苳': 0.57, '臺灣欒樹': 0.52, '白千層': 0.55,
  '楓香': 0.50, '黑板樹': 0.38, '小葉欖仁': 0.58, '大花紫薇': 0.72, '水黃皮': 0.63,
  '木棉': 0.30, '苦楝': 0.56, '刺桐': 0.30, '阿勃勒': 0.57, '烏桕': 0.52,
  '鳳凰木': 0.40, '臺灣櫸': 0.80, '杜英': 0.55, '無患子': 0.62, '福木': 0.65,
  '大葉山欖': 0.70, '九芎': 0.65, '光蠟樹': 0.62, '美人樹': 0.36, '印度紫檀': 0.75,
};
const DEFAULT_DENSITY = 0.50;
const BEF = 1.26;           // 生物量擴展係數（IPCC 2006 熱帶闊葉林）
const CARBON_FRACTION = 0.47; // 碳分率（IPCC 2006）
const CO2_FACTOR = 44 / 12;   // C → CO₂換算

const TAIPEI_RAIN_MM = 2400;   // 台北年均降雨量（mm）
const INTERCEPTION_RATE = 0.08;// 截留係數（Xiao et al. 2000）
const LAI = 4.0;               // 葉面積指數（i-Tree 闊葉樹預設）
const PM25_REMOVAL_KG_M2 = 0.028; // kg PM₂.₅ per m² 葉面積/年（Nowak et al. 2014）
const PM25_HEALTH_NTD_KG = 620;   // NT$/kg PM₂.₅健康成本（台灣環境部估算）
const COPOLLUTANT_FACTOR = 1.55;  // O₃、NO₂、SO₂ 等其他污染物加成

/**
 * 計算樹木生態效益
 * @param {object} tree  API 回傳的樹木物件（需含 species_name, dbh_cm；height_m 可估算）
 * @returns {{ co2_kg: number, rain_L: number, airpoll_ntd: number, height_estimated: boolean } | null}
 */
function calcBenefits(tree) {
  const D = parseFloat(tree.dbh_cm);
  if (!D) return null;

  // 樹高：有值直接用，無值依 DBH 估算（城市樹木異速生長，適用台灣都市樹種）
  let H = parseFloat(tree.height_m);
  let heightEstimated = false;
  if (!H) {
    H = Math.min(30, 4 + 0.25 * D);   // H_est = 4 + 0.25×DBH，上限 30m
    heightEstimated = true;
  }

  const rho = WOOD_DENSITY[tree.species_name] ?? DEFAULT_DENSITY;

  // ① 碳儲存（kg CO₂ 當量）
  const agb = 0.0509 * rho * D * D * H;      // 地上生物量（Brown 1997）
  const totalBiomass = agb * BEF;
  const co2_kg = Math.round(totalBiomass * CARBON_FRACTION * CO2_FACTOR);

  // ② 雨水截留（公升/年）
  const crownR = tree.crown_m ? tree.crown_m / 2 : H * 0.2;
  const crownArea = Math.PI * crownR * crownR;  // m²
  const rain_L = Math.round(crownArea * TAIPEI_RAIN_MM * INTERCEPTION_RATE);

  // ③ 空污效益（NT$/年）
  const leafArea = crownArea * LAI;
  const pm25_removed = leafArea * PM25_REMOVAL_KG_M2;
  const airpoll_ntd = Math.round(pm25_removed * PM25_HEALTH_NTD_KG * COPOLLUTANT_FACTOR);

  // ④ 遮蔭價值（m²）：樹冠垂直投影面積，夏季可降低地表溫度
  const shade_m2 = Math.round(crownArea);

  return { co2_kg, rain_L, airpoll_ntd, shade_m2, height_estimated: heightEstimated };
}
