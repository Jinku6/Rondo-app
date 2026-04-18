# Especificación Técnica: Sistema de Monetización Rondo (Modelo A - BlaBlaCar)

## 1. Resumen Ejecutivo
Implementación de un sistema de pagos custodial (Escrow) basado en **Stripe Connect**. Los jugadores pagan por adelantado para asegurar su plaza, y el dinero se liquida al organizador tras el partido, descontando comisiones de plataforma e impuestos.

---

## 2. Modelo Financiero y Cobros

### 2.1 Fórmula de Cálculo (Covering Costs)
Para que el organizador reciba el importe íntegro solicitado y Rondo sea rentable, la comisión se suma al precio base (Pb).

**Variables:**
- `Pb`: Precio fijado por el organizador (ej. 5.00€).
- `M_rondo`: Margen de Rondo (ej. 0.50€).
- `Fee_stripe`: 1.5% + 0.25€ (Tarifas estándar UE).

**Cálculo del Total al Jugador:**
`Total = (Pb + M_rondo + 0.25) / (1 - 0.015)`
`IVA = M_rondo * 0.21` (El IVA se aplica sobre el servicio de gestión de Rondo).

### 2.2 Flujo de Fondos (Escrow)
1. **Autorización:** Se bloquea el saldo al solicitar unirse.
2. **Captura:** Se realiza el cobro efectivo cuando el organizador pulsa "Aceptar".
3. **Custodia:** El dinero recibe en la cuenta de Stripe Connect de Rondo.
4. **Liquidación:** Se transfiere al organizador tras confirmar asistencia.

---

## 3. Políticas de Cancelación y Reembolso

| Escenario | Reembolso Jugador | Pago Organizador | Comisión Rondo |
| :--- | :--- | :--- | :--- |
| **Org. Cancela Partido** | 100% | 0€ (Penalización Reliability) | 0€ (Pérdida) |
| **Jugador Cancela >48h** | 100% | 0€ | 0€ |
| **Jugador Cancela 48h-4h** | 50% | 50% - (Fee Rondo + Stripe) | 100% Recaudada |
| **Jugador Cancela <4h / No-Show** | 0% | 100% - (Fee Rondo + Stripe) | 100% Recaudada |

---

## 4. Diseño de Base de Datos

### Nuevas Tablas
```sql
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_participant_id UUID NOT NULL REFERENCES public.match_participants(id),
  stripe_intent_id TEXT UNIQUE,
  total_amount NUMERIC NOT NULL,
  organizer_share NUMERIC NOT NULL,
  rondo_fee NUMERIC NOT NULL,
  status TEXT CHECK (status IN ('authorized', 'captured', 'refunded', 'disputed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES public.users(id),
  amount NUMERIC NOT NULL,
  stripe_transfer_id TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed')),
  processed_at TIMESTAMPTZ
);
```

---

## 5. Experiencia de Usuario (UI/UX)

### 5.1 Modal de Aviso de Cancelación
Al intentar cancelar dentro del periodo de 48h, se mostrará un aviso crítico:
- **Título:** "¿Confirmar cancelación?"
- **Mensaje:** "Faltan menos de 48h para el partido. Si cancelas ahora, solo recuperarás el 50% de tu dinero (**X.XX€**) y tu fiabilidad bajará."
- **Botón Primario:** "Mantenerme en el partido" (Verde).
- **Botón Secundario:** "Cancelar y asumir coste" (Rojo/Outlined).

---

## 6. Plan de Implementación (Roadmap)

### Fase 1: Infantrastructura (Semanas 1-2)
- [ ] Configuración de cuenta Stripe Connect.
- [ ] Creación de tablas de pagos en Supabase.
- [ ] Edge Function `create-payment-intent` (Autorización).

### Fase 2: Flujo de Aceptación (Semanas 3-4)
- [ ] Modificar lógica de "Aceptar Jugador" para disparar la captura del pago.
- [ ] Webhook de Stripe para actualizar estado de `payments`.
- [ ] UI: Pantalla de "Pago Seguro" al unirse.

### Fase 3: Liquidación y Cierre (Semanas 5-6)
- [ ] Sistema de asistencia: Al marcar "Asistió", se programa el Payout.
- [ ] Cron Job: Liquidación automática si el organizador no cierra el acta en 24h.
- [ ] UI: Modal de aviso de penalización por cancelación.

### Fase 4: Testing y Legal (Semanas 7+)
- [ ] Actualización de Términos y Condiciones (RGPD + Pagos).
- [ ] Pruebas en Stripe Test Mode con tarjetas de prueba.
