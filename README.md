<div align="center">

# [kiki](https://pideconkiki.com)

### La experiencia gastronómica del futuro.

<img src="assets/kiki-logo.png" width="96" height="96" style="border-radius: 22px" />

<br />

![TypeScript](https://img.shields.io/badge/TypeScript-000?style=flat-square&logo=typescript)
![React Native](https://img.shields.io/badge/React_Native-000?style=flat-square&logo=react)
![Next.js](https://img.shields.io/badge/Next.js-000?style=flat-square&logo=nextdotjs)
![Supabase](https://img.shields.io/badge/Supabase-000?style=flat-square&logo=supabase)
![Expo](https://img.shields.io/badge/Expo_SDK_52-000?style=flat-square&logo=expo)

</div>

---

kiki es una plataforma KaaS (Kioskos as a Service) — kioscos de autoservicio, sistema de visualización de cocina y panel de administración, todo conectado en tiempo real. Construido para la experiencia gastronómica moderna.

---

## Repositorio

Este es un monorepo que contiene cada superficie de la plataforma kiki.

```
kiki/
├── apps/
│   ├── kiosk/          Kiosco de autoservicio para el cliente
│   ├── admin/          POS del personal (gestión de órdenes + impresión térmica a cocina)
│   ├── admin-web/      Panel web para propietarios de restaurantes
│   └── kds/            Sistema de Visualización de Cocina (KDS)
├── packages/
│   └── shared/         Tipos TypeScript compartidos entre apps
└── supabase/           Esquema de base de datos, migraciones, edge functions
```

---

## Apps

### 📱 kiosk
> `apps/kiosk`

La experiencia de pedido del cliente. Corre en un kiosko Android dedicado en la entrada del restaurante. Los clientes navegan el menú, personalizan sus productos y pagan en el terminal — sin interacción con el personal.

| | |
|---|---|
| **Plataforma** | Kiosko Android |
| **Stack** | React Native · Expo SDK 52 · TypeScript |
| **Estado** | Zustand |
| **Backend** | Supabase Realtime · Row Level Security |
| **Auth** | Token de dispositivo anónimo (modo kiosco) |
| **i18n** | Español / Inglés |

---

### 🖨 admin
> `apps/admin`

Panel de control e impresión de tickets para cocina, operando en un dispositivo/datafono Android (Android 13). Muestra las órdenes entrantes en tiempo real, gestiona las transiciones de estado (confirmada → preparando → lista → completada) e imprime tickets de cocina con la impresora térmica integrada (senraise printer).

| | |
|---|---|
| **Plataforma** | Senraise POS (Android) |
| **Stack** | React Native · Expo SDK 52 · TypeScript |
| **Estado** | Zustand |
| **Backend** | Supabase Realtime |
| **Impresión** | `react-native-senraise-printer` (SDK nativo) |
| **Distribución** | EAS Build → APK sideloaded |

---

###  admin-web (coming soon)
> `apps/admin-web`

Panel web para propietarios y gerentes de restaurantes. Gestión de menú, analíticas, generación de tokens de dispositivo y configuración de sucursales.

| | |
|---|---|
| **Plataforma** | Web |
| **Stack** | Next.js 15 · TypeScript · Tailwind CSS |
| **Backend** | Supabase |
| **Auth** | Supabase Auth (email/contraseña) |

---

### 📺 kds (coming soon)
> `apps/kds`

Sistema de Visualización de Cocina — pantalla montada en la pared de la cocina que muestra la cola de órdenes en vivo y su estado. Reemplaza los tickets de papel para el personal de cocina.

| | |
|---|---|
| **Plataforma** | Tablet Android (montada en pared) |
| **Stack** | React Native · Expo SDK 52 · TypeScript |
| **Backend** | Supabase Realtime |

---

## Backend

> `supabase/`

Esquema PostgreSQL multi-tenant con Row Level Security completo. Las organizaciones son dueñas de múltiples sucursales. Cada sucursal tiene su propio menú, órdenes y dispositivos.

```
organizations → restaurants → categories → menu_items → customization_groups → customization_options
                           → orders → order_items → order_item_customizations
                           → device_tokens
```

| | |
|---|---|
| **Base de datos** | PostgreSQL (Supabase) |
| **Realtime** | Supabase Realtime (órdenes, menú) |
| **Auth** | Supabase Auth + sesiones anónimas para kiosco |
| **RLS** | Políticas por organización, sucursal y rol |
| **Edge Functions** | Deno (traducción, webhooks) |

---

## La marca kiki

<table>
<tr>
<td>

### Colores

| Token | Hex | |
|---|---|---|
| Primary | `#ccff00` | ![](https://img.shields.io/badge/-%23ccff00-ccff00?style=flat-square) |
| Secondary | `#ff6b98` | ![](https://img.shields.io/badge/-%23ff6b98-ff6b98?style=flat-square) |
| Tertiary | `#00f0ff` | ![](https://img.shields.io/badge/-%2300f0ff-00f0ff?style=flat-square) |
| Background | `#060e1d` | ![](https://img.shields.io/badge/-%23060e1d-060e1d?style=flat-square) |
| Surface | `#0f192c` | ![](https://img.shields.io/badge/-%230f192c-0f192c?style=flat-square) |
| Texto | `#dde5fb` | ![](https://img.shields.io/badge/-%23dde5fb-dde5fb?style=flat-square) |

</td>
<td>

### Tipografía

| Rol | Fuente | Peso |
|---|---|---|
| Títulos | Space Grotesk | 900 |
| Cuerpo / UI | Syne | 400 · 600 · 700 |
| Etiquetas | Syne | 700 |

### Glow
```
Primary   — rgba(204,255,0, 0.4)
Secondary — rgba(255,107,152, 0.4)
Tertiary  — rgba(0,240,255, 0.4)
```

</td>
</tr>
</table>

---

<div align="center">

Hecho en Panamá 🇵🇦 · [pideconkiki.com](https://pideconkiki.com)

</div>
