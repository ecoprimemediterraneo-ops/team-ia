// Semilla del salón fundador "Bendito Arte Micropigmentación".
// Se inyecta UNA sola vez en prod (guardado por flag KV en readConfigs) para dar
// de alta el salón sin escribir Supabase a mano. Generado desde el alta local.
import type { BusinessBooking } from "./booking";

export function benditoArteSeed(): BusinessBooking {
  return {
  "slug": "bendito-arte",
  "tenantId": "tenant_aiteam",
  "nombre": "Bendito Arte Micropigmentación",
  "descripcion": "Micropigmentación, cejas, pestañas, uñas y maquillaje en Marbella. Reserva online en segundos — cancelación gratis, sin comisiones.",
  "galeria": [],
  "direccion": "Calle Magdalena, local 1C, 29601 Marbella, Málaga",
  "lat": 36.5177271,
  "lng": -4.886683,
  "telefono": "+34 656 989 373",
  "instagram": "benditoarte_micropigmentacion",
  "calendarEmail": "ecoprimemediterraneo@gmail.com",
  "timezone": "Europe/Madrid",
  "slotStepMin": 15,
  "leadTimeMin": 60,
  "cancelAntelacionMin": 120,
  "categorias": [
    {
      "id": "cat_cejas",
      "nombre": "Cejas"
    },
    {
      "id": "cat_lashes",
      "nombre": "Lashes"
    },
    {
      "id": "cat_maquillaje",
      "nombre": "Maquillaje"
    },
    {
      "id": "cat_manicura",
      "nombre": "Manicura"
    },
    {
      "id": "cat_pedicura",
      "nombre": "Pedicura"
    }
  ],
  "servicios": [
    {
      "id": "svc_ba_1",
      "categoriaId": "cat_cejas",
      "nombre": "Diseño, depilación y tinte híbrido",
      "durationMin": 30,
      "precioEUR": 15,
      "activo": true
    },
    {
      "id": "svc_ba_2",
      "categoriaId": "cat_cejas",
      "nombre": "Depilación labio superior",
      "durationMin": 5,
      "precioEUR": 3,
      "activo": true
    },
    {
      "id": "svc_ba_3",
      "categoriaId": "cat_cejas",
      "nombre": "Depilación de cejas (cera y pinza)",
      "durationMin": 15,
      "precioEUR": 8,
      "activo": true
    },
    {
      "id": "svc_ba_4",
      "categoriaId": "cat_cejas",
      "nombre": "Diseño y depilación de cejas + facial",
      "durationMin": 30,
      "precioEUR": 12,
      "activo": true
    },
    {
      "id": "svc_ba_5",
      "categoriaId": "cat_cejas",
      "nombre": "Diseño, depilación + henna",
      "durationMin": 30,
      "precioEUR": 15,
      "activo": true
    },
    {
      "id": "svc_ba_6",
      "categoriaId": "cat_cejas",
      "nombre": "Henna de cejas",
      "durationMin": 20,
      "precioEUR": 12,
      "activo": true
    },
    {
      "id": "svc_ba_7",
      "categoriaId": "cat_cejas",
      "nombre": "Laminado de cejas",
      "durationMin": 60,
      "precioEUR": 40,
      "activo": true
    },
    {
      "id": "svc_ba_8",
      "categoriaId": "cat_cejas",
      "nombre": "Repaso micropigmentación anual",
      "durationMin": 150,
      "precioEUR": 145,
      "activo": true
    },
    {
      "id": "svc_ba_9",
      "categoriaId": "cat_cejas",
      "nombre": "Promo micropigmentación soft liner",
      "durationMin": 120,
      "precioEUR": 229,
      "activo": true
    },
    {
      "id": "svc_ba_10",
      "categoriaId": "cat_cejas",
      "nombre": "Promo tinte híbrido",
      "durationMin": 30,
      "precioEUR": 10,
      "activo": true
    },
    {
      "id": "svc_ba_11",
      "categoriaId": "cat_lashes",
      "nombre": "Lifting de pestañas + tinte",
      "durationMin": 70,
      "precioEUR": 32,
      "activo": true
    },
    {
      "id": "svc_ba_12",
      "categoriaId": "cat_lashes",
      "nombre": "Extensiones clásicas",
      "durationMin": 105,
      "precioEUR": 57,
      "activo": true
    },
    {
      "id": "svc_ba_13",
      "categoriaId": "cat_lashes",
      "nombre": "Volumen Bendito 2D-3D",
      "durationMin": 105,
      "precioEUR": 60,
      "activo": true
    },
    {
      "id": "svc_ba_14",
      "categoriaId": "cat_lashes",
      "nombre": "Volumen ruso",
      "durationMin": 120,
      "precioEUR": 65,
      "activo": true
    },
    {
      "id": "svc_ba_15",
      "categoriaId": "cat_lashes",
      "nombre": "Volumen gipsy",
      "durationMin": 150,
      "precioEUR": 60,
      "activo": true
    },
    {
      "id": "svc_ba_16",
      "categoriaId": "cat_lashes",
      "nombre": "Volumen brasileño",
      "durationMin": 120,
      "precioEUR": 65,
      "activo": true
    },
    {
      "id": "svc_ba_17",
      "categoriaId": "cat_lashes",
      "nombre": "Megavolumen",
      "durationMin": 180,
      "precioEUR": 75,
      "activo": true
    },
    {
      "id": "svc_ba_18",
      "categoriaId": "cat_lashes",
      "nombre": "Volumen extra largas",
      "durationMin": 165,
      "precioEUR": 80,
      "activo": true
    },
    {
      "id": "svc_ba_19",
      "categoriaId": "cat_lashes",
      "nombre": "Relleno ruso (1 semana)",
      "durationMin": 60,
      "precioEUR": 30,
      "activo": true
    },
    {
      "id": "svc_ba_20",
      "categoriaId": "cat_lashes",
      "nombre": "Relleno ruso (2 semanas)",
      "durationMin": 90,
      "precioEUR": 37,
      "activo": true
    },
    {
      "id": "svc_ba_21",
      "categoriaId": "cat_lashes",
      "nombre": "Relleno ruso (3 semanas)",
      "durationMin": 90,
      "precioEUR": 42,
      "activo": true
    },
    {
      "id": "svc_ba_22",
      "categoriaId": "cat_lashes",
      "nombre": "Relleno ruso (4 semanas)",
      "durationMin": 90,
      "precioEUR": 50,
      "activo": true
    },
    {
      "id": "svc_ba_23",
      "categoriaId": "cat_lashes",
      "nombre": "Relleno megavolumen",
      "durationMin": 120,
      "precioEUR": 50,
      "activo": true
    },
    {
      "id": "svc_ba_24",
      "categoriaId": "cat_lashes",
      "nombre": "Relleno de otro centro",
      "durationMin": 105,
      "precioEUR": 50,
      "activo": true
    },
    {
      "id": "svc_ba_25",
      "categoriaId": "cat_lashes",
      "nombre": "Retirada (otro centro)",
      "durationMin": 30,
      "precioEUR": 20,
      "activo": true
    },
    {
      "id": "svc_ba_26",
      "categoriaId": "cat_lashes",
      "nombre": "Retirada (nuestro centro)",
      "durationMin": 30,
      "precioEUR": 10,
      "activo": true
    },
    {
      "id": "svc_ba_27",
      "categoriaId": "cat_maquillaje",
      "nombre": "Maquillaje de noche + postizas",
      "durationMin": 60,
      "precioEUR": 35,
      "activo": true
    },
    {
      "id": "svc_ba_28",
      "categoriaId": "cat_maquillaje",
      "nombre": "Maquillaje clásico + postizas",
      "durationMin": 60,
      "precioEUR": 30,
      "activo": true
    },
    {
      "id": "svc_ba_29",
      "categoriaId": "cat_maquillaje",
      "nombre": "Maquillaje de fiesta + postizas",
      "durationMin": 60,
      "precioEUR": 35,
      "activo": true
    },
    {
      "id": "svc_ba_30",
      "categoriaId": "cat_manicura",
      "nombre": "Extensión (primera puesta)",
      "durationMin": 90,
      "precioEUR": 33,
      "activo": true
    },
    {
      "id": "svc_ba_31",
      "categoriaId": "cat_manicura",
      "nombre": "Relleno de uñas",
      "durationMin": 75,
      "precioEUR": 26,
      "activo": true
    },
    {
      "id": "svc_ba_32",
      "categoriaId": "cat_manicura",
      "nombre": "Semipermanente completa",
      "durationMin": 60,
      "precioEUR": 24,
      "activo": true
    },
    {
      "id": "svc_ba_33",
      "categoriaId": "cat_manicura",
      "nombre": "Semipermanente express",
      "durationMin": 45,
      "precioEUR": 20,
      "activo": true
    },
    {
      "id": "svc_ba_34",
      "categoriaId": "cat_manicura",
      "nombre": "Esmaltado normal",
      "durationMin": 25,
      "precioEUR": 13,
      "activo": true
    },
    {
      "id": "svc_ba_35",
      "categoriaId": "cat_manicura",
      "nombre": "Retirada de acrílico",
      "durationMin": 30,
      "precioEUR": 10,
      "activo": true
    },
    {
      "id": "svc_ba_36",
      "categoriaId": "cat_manicura",
      "nombre": "Cortar uñas",
      "durationMin": 15,
      "precioEUR": 6,
      "activo": true
    },
    {
      "id": "svc_ba_37",
      "categoriaId": "cat_manicura",
      "nombre": "Retirada de semipermanente",
      "durationMin": 15,
      "precioEUR": 5,
      "activo": true
    },
    {
      "id": "svc_ba_38",
      "categoriaId": "cat_pedicura",
      "nombre": "Esmaltado semipermanente (pies)",
      "durationMin": 35,
      "precioEUR": 16,
      "activo": true
    },
    {
      "id": "svc_ba_39",
      "categoriaId": "cat_pedicura",
      "nombre": "Completa sin esmaltado",
      "durationMin": 40,
      "precioEUR": 18,
      "activo": true
    },
    {
      "id": "svc_ba_40",
      "categoriaId": "cat_pedicura",
      "nombre": "Completa + esmaltado normal",
      "durationMin": 60,
      "precioEUR": 22,
      "activo": true
    },
    {
      "id": "svc_ba_41",
      "categoriaId": "cat_pedicura",
      "nombre": "Completa + esmaltado semipermanente",
      "durationMin": 70,
      "precioEUR": 27,
      "activo": true
    }
  ],
  "empleados": [],
  "horario": {
    "0": {
      "abierto": false,
      "franjas": []
    },
    "1": {
      "abierto": true,
      "franjas": [
        {
          "desde": "09:00",
          "hasta": "14:00"
        },
        {
          "desde": "16:00",
          "hasta": "20:00"
        }
      ]
    },
    "2": {
      "abierto": true,
      "franjas": [
        {
          "desde": "09:00",
          "hasta": "14:00"
        },
        {
          "desde": "16:00",
          "hasta": "20:00"
        }
      ]
    },
    "3": {
      "abierto": true,
      "franjas": [
        {
          "desde": "09:00",
          "hasta": "14:00"
        },
        {
          "desde": "16:00",
          "hasta": "20:00"
        }
      ]
    },
    "4": {
      "abierto": true,
      "franjas": [
        {
          "desde": "09:00",
          "hasta": "14:00"
        },
        {
          "desde": "16:00",
          "hasta": "20:00"
        }
      ]
    },
    "5": {
      "abierto": true,
      "franjas": [
        {
          "desde": "09:00",
          "hasta": "14:00"
        },
        {
          "desde": "16:00",
          "hasta": "20:00"
        }
      ]
    },
    "6": {
      "abierto": false,
      "franjas": []
    }
  }
} as BusinessBooking;
}
