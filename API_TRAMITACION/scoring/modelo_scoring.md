# Modelo de scoring crediticio — `API_TRAMITACION/scoring/`

Documentación del módulo de scoring: **qué es**, **cómo funciona** y **sus limitaciones**.
Pensado para que cualquiera del equipo entienda el modelo sin leer todo el código.

> Documentos relacionados: `SCORING_PENDIENTES.md` (problemas conocidos y cuándo re-entrenar)
> y `hito final/INFORME-Soluciones-Scoring.md` (justificación de la recalibración chilena).

---

## 1. Qué es

Un modelo de **regresión logística** que, dado el perfil de un solicitante, estima la
**probabilidad de que caiga en mora grave** (atraso de 90+ días). Esa probabilidad (`score`,
entre 0 y 1) se usa como **filtro automático** dentro del flujo de solicitud de crédito.

- Corre **100% en Node.js** (sin Python ni servicios externos).
- Los parámetros del modelo viven como JSON en `scoring/model/`.
- El resultado se persiste en cada solicitud: `loan_applications.score` y `scoring_decision`.

> ⚠️ Es un modelo **académico, mínimamente funcional**: sirve para demostrar el flujo, **no** es
> un sistema de credit scoring de producción real (ver §5).

---

## 2. Cómo funciona

### 2.1 La cascada de decisión (`scoringService.decide`)

Toda solicitud pasa por tres etapas, en orden:

1. **Filtros duros (reglas de negocio, no entran al modelo):**
   - `edad` fuera de **[18, 75]** → `rejected` (`hard_filter_edad`).
   - **DTI** = `cuota / ingreso_mensual` > **0.30** → `rejected` (`hard_filter_dti`).
2. **Modelo logístico:** sobre lo que pasa los filtros, calcula el `score`.
   - `score ≥ threshold (0.59)` → `rejected` (`model_reject`).
   - `score <  threshold` → `approved` (`model_approve`).
3. **Fail-safe:** si el modelo lanza un error, la solicitud **no** se aprueba ni se rechaza
   sola → `under_review` (`scoring_decision = 'scoring_unavailable'`).

### 2.2 La matemática del `score` (`adapters/jsPureAdapter.js`)

Es una regresión logística sobre **features estandarizadas**:

```
z     = intercept + Σ  coefᵢ · (xᵢ − meanᵢ) / scaleᵢ
score = sigmoid(z)        // probabilidad de default, 0..1
```

Tres archivos en `scoring/model/` parametrizan el cálculo:

| Archivo | Contenido |
|---|---|
| `coeficientes.json` | Pesos aprendidos (`coefᵢ`, `intercept`) y el `threshold` (0.59). |
| `scaler.json` | `meanᵢ` y `scaleᵢ` de cada feature (normalización *StandardScaler*). |
| `medians.json` | Valores con que se **imputan** las features ausentes. |

> **Idea clave:** los **coeficientes** son la *relación aprendida* ("más deuda → más riesgo").
> El `mean`/`scale` solo *posiciona* cada variable en la escala que el modelo espera. Cambiar
> `mean`/`scale` re-normaliza la entrada **sin re-entrenar** (ver §4).

### 2.3 Las 5 features

| Feature | Significado | ¿Se captura en producción? |
|---|---|---|
| `monthly_income` | Ingreso mensual declarado (CLP) | ✅ Formulario |
| `debt_ratio_kaggle` | `deuda_cmf / monthly_income` | ✅ Deuda vía OCR del carnet |
| `edad` | Edad del solicitante | ✅ OCR del carnet |
| `deuda_relativa` | (predictor de mayor peso, +0.976) | ❌ **No se captura** → imputada |
| `num_creditos` | N.º de créditos vigentes | ❌ **No se captura** → imputada |

Las features ausentes se imputan con `medians.json` antes de escalar (igual que en el
entrenamiento).

### 2.4 Adapters

El cálculo se delega a un *adapter* intercambiable (`SCORING_ADAPTER` en `.env`):

- **`js`** (activo): reimplementa la inferencia en Node puro. Es el que se usa.
- **`onnx`** / **`python`**: **stubs** (no implementados), pensados para un futuro modelo
  no-lineal. Hoy lanzan error si se seleccionan.

---

## 3. Cómo probarlo

Desde `API_TRAMITACION/scoring/`:

```bash
node test_cascade.js   # valida la cascada (filtros duros + modelo + fail-safe)
node test_parity.js    # valida que la matemática del adapter JS es correcta
```

`test_parity.js` compara el `score` del adapter contra una **referencia del pipeline**
(StandardScaler + LogisticRegression) calculada de forma independiente sobre los mismos JSON.
Si se vuelven a tocar los coeficientes o el scaler, hay que **regenerar esas referencias**.

---

## 4. Estado actual: recalibración al mercado chileno

El modelo se entrenó con el dataset de Kaggle *"Give Me Some Credit"* (clientes de **EE.UU.,
2005–2007**), en **dólares**. Eso causaba que un sueldo chileno en pesos (ej. $1.200.000 CLP)
entrara en una escala equivocada y **saturara el `score` a ~0** (aprobaba casi siempre).

**Qué se hizo (sin re-entrenar):** se recalibraron `scaler.json` y `medians.json` a magnitudes
chilenas, conservando los coeficientes aprendidos:

| Feature | `mean` | `scale` | mediana de imputación |
|---|---|---|---|
| `monthly_income` | 900.000 | 500.000 | 700.000 |
| `debt_ratio_kaggle` | 0.5 | 0.5 | 0.4 |
| `edad` | 52.27 *(sin cambio)* | 14.67 *(sin cambio)* | 40 |
| `deuda_relativa` | 0.31978 *(sin cambio)* | 0.35184 *(sin cambio)* | **0.31978** (= mean) |
| `num_creditos` | 8.41 *(sin cambio)* | 4.95 *(sin cambio)* | 8 |

Resultado verificado: el sueldo de $1.200.000 ya **no satura** (`score` ~0.44 en vez de ~0) y
los puntajes se distribuyen de forma sensata según riesgo. Ambos tests siguen en verde.

> **Detalle `deuda_relativa`:** es el predictor de mayor peso pero **no se captura** en
> producción. Antes se imputaba con un valor que metía un sesgo fijo de ~−0.46 hacia aprobar a
> **todas** las solicitudes. Se **neutralizó** imputándola con la media del scaler (valor
> estandarizado 0 → no aporta sesgo) mientras no se capture como input real.

---

## 5. Limitaciones (importante)

| # | Limitación | Estado |
|---|---|---|
| 1 | Entrenado con datos de EE.UU. en USD | ✅ **Mitigado** por recalibración (no re-entrenado) |
| 3 | `debt_ratio_kaggle` con distribución distinta a producción | ✅ **Mitigado** por recalibración |
| 2 | La variable objetivo es un **proxy** (mora 90+ días, no pérdida real) | ⚠️ Requiere datos propios + re-entrenar |
| 4 | `employment_status` y plazo **no** son features del modelo | ➖ Mejora futura (re-entrenar) |
| 5 | No hay pipeline de re-entrenamiento (*model drift*) | ➖ Fuera de alcance académico |

Puntos a tener siempre presentes:

- **La recalibración hace al modelo *razonable*, no *real*.** Los valores chilenos son
  **supuestos de referencia razonables y ajustables**, no estadísticas medidas sobre cartera
  propia.
- El `score` es una **probabilidad estimada de mora a 90+ días**, no una medida de pérdida real.
  Tratarlo como **indicador orientativo**.
- Para un fix de verdad (Problemas 2, 4, 5) hace falta **acumular cartera propia chilena
  (≥ 5.000 solicitudes con resultado conocido) y re-entrenar**. El detalle de criterios y
  métricas de monitoreo está en `SCORING_PENDIENTES.md`.

---

*Módulo de scoring del Grupo 08 — proyecto académico de préstamos digitales.*
