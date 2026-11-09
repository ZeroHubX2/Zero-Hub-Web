const APP_ID = (process.env.DISCORD_APP_ID || "").trim();
const GUILD_ID = (process.env.DISCORD_GUILD_ID || "").trim();
const TOKEN = (process.env.DISCORD_BOT_TOKEN || "").trim();

if (!APP_ID || !GUILD_ID || !TOKEN) {
  console.error("ต้องตั้ง DISCORD_APP_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN ก่อนรัน");
  process.exit(1);
}

const STRING = 3;
const INTEGER = 4;
const BOOLEAN = 5;
const USER = 6;
const NUMBER = 10;
const ADMIN = "8";

const TIERS = [
  { name: "1 วัน", value: "24h" },
  { name: "3 วัน", value: "3d" },
  { name: "7 วัน", value: "7d" },
  { name: "ถาวร", value: "lifetime" },
];

const PERIODS = [
  { name: "วันนี้", value: "today" },
  { name: "เมื่อวาน", value: "yesterday" },
  { name: "7 วันล่าสุด", value: "7d" },
  { name: "30 วันล่าสุด", value: "30d" },
  { name: "เดือนนี้", value: "month" },
  { name: "เดือนที่แล้ว", value: "lastmonth" },
  { name: "ทั้งหมด", value: "all" },
];

const METHODS = [
  { name: "โอนธนาคาร", value: "bank" },
  { name: "TrueMoney (โอนตรง)", value: "truemoney" },
  { name: "อื่น ๆ", value: "other" },
];

const commands = [
  {
    name: "genkey",
    description: "สร้างคีย์ (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
    options: [
      { type: STRING, name: "tier", description: "แพ็กเกจ", required: true, choices: TIERS },
      { type: USER, name: "user", description: "ผู้ซื้อ (ให้ยศ Buyer อัตโนมัติ)" },
      { type: INTEGER, name: "count", description: "จำนวนคีย์ (1-20)", min_value: 1, max_value: 20 },
      { type: STRING, name: "note", description: "บันทึก เช่น สลิปจากใคร", max_length: 200 },
    ],
  },
  {
    name: "keys",
    description: "ดูรายการคีย์ (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
    options: [
      { type: USER, name: "user", description: "กรองตามผู้ใช้" },
      { type: STRING, name: "key", description: "ค้นหาคีย์" },
    ],
  },
  {
    name: "revokekey",
    description: "ระงับคีย์ (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
    options: [
      { type: STRING, name: "key", description: "คีย์", required: true },
      { type: BOOLEAN, name: "undo", description: "ยกเลิกการระงับ" },
    ],
  },
  {
    name: "deletekey",
    description: "ลบคีย์ถาวร (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
    options: [{ type: STRING, name: "key", description: "คีย์ที่จะลบ", required: true }],
  },
  {
    name: "extendkey",
    description: "ต่อเวลาคีย์ (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
    options: [
      { type: STRING, name: "key", description: "คีย์", required: true },
      { type: NUMBER, name: "days", description: "จำนวนวัน (ใส่ 0.5 = 12 ชม.)", required: true, min_value: 0.01, max_value: 3650 },
    ],
  },
  {
    name: "redeem",
    description: "ผูกคีย์กับบัญชี Discord และรับยศ Buyer",
    dm_permission: false,
    options: [{ type: STRING, name: "key", description: "คีย์ที่ซื้อมา", required: true }],
  },
  {
    name: "mykey",
    description: "ดูคีย์ของฉัน",
    dm_permission: false,
  },
  {
    name: "resethwid",
    description: "รีเซ็ต HWID เพื่อย้ายเครื่อง (วันละครั้ง)",
    dm_permission: false,
    options: [{ type: STRING, name: "key", description: "คีย์ (ไม่ต้องใส่ถ้ามีคีย์เดียว)" }],
  },
  {
    name: "sales",
    description: "ดูยอดขายร้าน รายวัน/รายเดือน (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
    options: [
      { type: STRING, name: "period", description: "ช่วงเวลา (ค่าเริ่มต้น = วันนี้)", choices: PERIODS },
      { type: STRING, name: "month", description: "ดูทั้งเดือน เช่น 2026-11", max_length: 7 },
      { type: STRING, name: "from", description: "ตั้งแต่วันที่ เช่น 2026-11-01", max_length: 10 },
      { type: STRING, name: "to", description: "ถึงวันที่ เช่น 2026-11-09", max_length: 10 },
    ],
  },
  {
    name: "addsale",
    description: "ลงบิลยอดขายที่ลูกค้าโอนเอง (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
    options: [
      { type: NUMBER, name: "amount", description: "ยอดเงิน (บาท)", required: true, min_value: 0.01, max_value: 1000000 },
      { type: STRING, name: "method", description: "ช่องทาง (ค่าเริ่มต้น = โอนธนาคาร)", choices: METHODS },
      { type: USER, name: "user", description: "ลูกค้า (ถ้าอยู่ในดิสคอร์ด)" },
      { type: STRING, name: "name", description: "ชื่อลูกค้า (ถ้าไม่ได้เลือก user)", max_length: 100 },
      { type: STRING, name: "note", description: "บันทึก เช่น ซื้อคีย์ 7 วัน", max_length: 200 },
      { type: STRING, name: "date", description: "วันที่โอน เช่น 2026-11-08 (ไม่ใส่ = วันนี้)", max_length: 10 },
    ],
  },
  {
    name: "bills",
    description: "ดูรายการบิลที่ลงเอง (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
    options: [
      { type: STRING, name: "period", description: "ช่วงเวลา (ค่าเริ่มต้น = 7 วันล่าสุด)", choices: PERIODS },
      { type: STRING, name: "month", description: "ดูทั้งเดือน เช่น 2026-11", max_length: 7 },
    ],
  },
  {
    name: "delsale",
    description: "ลบบิลที่ลงผิด (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
    options: [{ type: INTEGER, name: "id", description: "เลขบิล เช่น 12", required: true, min_value: 1 }],
  },
  {
    name: "panel",
    description: "โพสต์แผงคีย์ Zero Hub ในห้องนี้ (แอดมิน)",
    default_member_permissions: ADMIN,
    dm_permission: false,
  },
];

fetch(`https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands),
})
  .then(async (r) => {
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${text}`);
    console.log(`ลงทะเบียน ${JSON.parse(text).length} คำสั่งแล้ว`);
  })
  .catch((err) => {
    console.error("ลงทะเบียนไม่สำเร็จ:", err.message);
    process.exit(1);
  });
