export const terminology = [
  { thai: "กะ", english: "Shift" }, { thai: "ไลน์ผลิต", english: "Production Line" },
  { thai: "งานค้าง", english: "WIP" }, { thai: "ของเสีย", english: "Defect / Scrap" },
  { thai: "ช่าง", english: "Technician" }, { thai: "ใบงาน", english: "Work Order" },
];
export const protectedTerms = ["Serial No.", "BPNO", "Operation", "Model Name", "Part Number", "Lot Number"];
export const modes = [
  { id: "professional", label: "Professional", description: "Clear and professional workplace English.", available: true },
  { id: "manufacturing", label: "Manufacturing", description: "Uses standard production and manufacturing terminology.", available: false },
  { id: "email", label: "Email", description: "Polished English suitable for business emails.", available: false },
  { id: "technical", label: "Technical", description: "Preserves technical terminology and technical context.", available: false },
  { id: "simple", label: "Simple English", description: "Easy-to-understand English using simple vocabulary.", available: false },
];
