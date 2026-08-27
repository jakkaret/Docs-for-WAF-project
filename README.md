# WAF + CDN Platform — Docs Site

เว็บไซต์เอกสารสถาปัตยกรรมของแพลตฟอร์ม WAF + CDN แบบ multi-tenant (โปรเจกต์ capstone) จัดทำจากการสำรวจเครื่องจริง (SSH + อ่าน source code + `docker ps`) ไม่ใช่การอนุมานจากชื่อไฟล์

**เว็บไซต์ที่ deploy แล้ว:** https://jakkaret.github.io/Docs-for-WAF-project/

## โครงสร้าง

เว็บไซต์เป็น static HTML/CSS/JS ล้วน (ไม่มี build step) อยู่ในโฟลเดอร์ [`site/`](./site):

```
site/
├── index.html                 หน้าแรก — ภาพรวมระบบ + สถานะความสามารถทั้งหมด
├── 01-waf-engine.html
├── 02-cdn-geodns.html
├── 03-dashboard-backend.html
├── 04-ml-ai-detection.html
├── 05-tunnel-system.html
├── 06-data-storage.html
├── 07-web-origin-testbed.html
├── 08-attack-landscape.html
└── assets/
    ├── css/style.css          ระบบดีไซน์ (schematic/operations-console)
    └── js/main.js             interaction: pipeline animation, scroll reveal, status filter
```

เนื้อหาต้นฉบับ (markdown) อยู่ที่ `../Claude_workspace/docs/` ของผู้จัดทำ — หน้าเว็บแต่ละหน้าคือการแปลเนื้อหานั้นเป็น HTML ที่จัดหมวดหมู่ตามสถานะจริง (ทำงานจริง / เขียนเสร็จยังไม่ต่อสาย / ช่องโหว่ / หนี้ทางสถาปัตยกรรม)

## แก้ไขเนื้อหา

แก้ไฟล์ `.html` ใน `site/` ตรง ๆ ได้เลย ไม่ต้อง build — เปิดดูผลลัพธ์ในเบราว์เซอร์ทันทีด้วย:

```bash
cd site && python3 -m http.server 8080
```

## Deploy

Push เข้า branch `main` แล้ว GitHub Actions ([`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)) จะอัปโหลดโฟลเดอร์ `site/` ขึ้น GitHub Pages อัตโนมัติ ไม่มี build step ใด ๆ

## หมายเหตุ

โฟลเดอร์ [`_old-docusaurus-scaffold/`](./_old-docusaurus-scaffold) เก็บสก๊าฟโฟลด์ Docusaurus ชุดแรกที่ถูกแทนที่ด้วยเว็บไซต์นี้ (เก็บไว้เพื่อประวัติ ไม่ได้ถูก deploy)
