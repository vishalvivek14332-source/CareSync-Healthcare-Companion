# CareSync Deterministic CareScore Calculation Specification

## 1. Overview & Core Principles

The **CareScore** is an objective, deterministic wellness index (scaled 0 to 100) calculated directly from real patient activity and adherence data.

### Anti-Patterns Strictly Eliminated:
- **No Hardcoded Constants**: The legacy default score `66` has been completely removed.
- **No Fabricated Data**: A fresh patient account with zero recorded activities is recognized as a **"New Setup"** state and begins at an unpenalized baseline (100% adherence to all active tasks), shifting dynamically as actual events occur.

---

## 2. Mathematical Formulation

CareScore dynamically distributes weights across **four clinical categories**:

$$\text{CareScore} = \sum (S_i \times W_i) \quad \text{for all active categories } i$$

Where:
- $S_i$ is the individual score percentage ($0 - 100\%$) for category $i$.
- $W_i$ is the dynamic normalized weight assigned to category $i$.

### Category Scoring Rules:

1. **Medication Adherence ($S_{\text{med}}$ - Nominal Weight: 35%)**:
   - Evaluates confirmed scheduled doses for the current calendar date.
   - If 0 medications are scheduled: weight is 0% (unpenalized).
   - $S_{\text{med}} = \frac{\text{Taken Doses}}{\text{Total Scheduled Doses}} \times 100\%$
   - Overdue/missed doses decrease this component.

2. **Hydration Progress ($S_{\text{hyd}}$ - Nominal Weight: 25%)**:
   - $S_{\text{hyd}} = \min\left(100, \frac{\text{Current Liters Logged}}{\text{Daily Goal Liters}} \times 100\%\right)$
   - If no goal is configured or goal is 0: weight is 0%.

3. **Physical Activity ($S_{\text{act}}$ - Nominal Weight: 20%)**:
   - $S_{\text{act}} = \min\left(100, \frac{\text{Hardware Steps Logged}}{\text{Daily Step Goal}} \times 100\%\right)$
   - On platforms where pedometer sensors are unavailable (e.g. web sandbox), $S_{\text{act}}$ is not penalized.

4. **Daily Routine Completion ($S_{\text{rout}}$ - Nominal Weight: 20%)**:
   - $S_{\text{rout}} = \frac{\text{Completed Routine Checkpoints}}{\text{Total Configured Routines}} \times 100\%$
   - If 0 routines exist: weight is 0%.

---

## 3. Dynamic Weight Normalization

When a category has no active configuration or records (e.g. a patient with no medications assigned):

$$W_i = \frac{W_i^{\text{nominal}}}{\sum_{\text{active}} W_j^{\text{nominal}}}$$

This guarantees the sum of active weights is always exactly 1.0 (100%), ensuring the patient is never penalized for categories they do not have.
