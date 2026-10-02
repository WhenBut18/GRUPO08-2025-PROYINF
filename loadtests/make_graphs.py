#!/usr/bin/env python3

import csv
import sys
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = Path(__file__).parent
THRESHOLD_MS = 1000  # umbral "esperado" de la pauta


def load(jtl):
    """Devuelve listas (t_seg_relativo, elapsed_ms)."""
    ts, el = [], []
    with open(jtl, newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            ts.append(int(row["timeStamp"]))
            el.append(int(row["elapsed"]))
    if not ts:
        return [], []
    t0 = min(ts)
    return [(t - t0) / 1000.0 for t in ts], el


def over_time(plan, n):
    jtl = HERE / f"result-{plan}-{n}.jtl"
    if not jtl.exists():
        return
    t, el = load(jtl)
    if not t:
        return
    breaches = sum(1 for e in el if e > THRESHOLD_MS)
    pct = 100.0 * breaches / len(el)
    plt.figure(figsize=(11, 5))
    plt.scatter(t, el, s=4, alpha=0.35, label="response time (ms)")
    plt.axhline(THRESHOLD_MS, color="red", ls="--", lw=1.5,
                label=f"umbral {THRESHOLD_MS} ms")
    plt.title(f"Response Times Over Time - {plan} - {n} usuarios concurrentes\n"
              f"{len(el)} muestras | {breaches} sobre el umbral ({pct:.2f}%)")
    plt.xlabel("tiempo desde el inicio (s)")
    plt.ylabel("response time (ms)")
    plt.legend(loc="upper right")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    out = HERE / f"response-time-{plan}-{n}.png"
    plt.savefig(out, dpi=110)
    plt.close()
    print(f"  {out.name}: avg={sum(el)/len(el):.0f}ms  max={max(el)}ms  >umbral={pct:.2f}%")


def breakpoint(plan, levels):
    xs, avgs, errs = [], [], []
    for n in levels:
        jtl = HERE / f"result-{plan}-{n}.jtl"
        if not jtl.exists():
            continue
        _, el = load(jtl)
        if not el:
            continue
        xs.append(n)
        avgs.append(sum(el) / len(el))
        errs.append(100.0 * sum(1 for e in el if e > THRESHOLD_MS) / len(el))
    if not xs:
        return
    fig, ax1 = plt.subplots(figsize=(9, 5))
    ax1.plot(xs, avgs, "o-", color="tab:blue", label="average (ms)")
    ax1.axhline(THRESHOLD_MS, color="red", ls="--", lw=1.2, label="umbral 1000 ms")
    ax1.set_xlabel("usuarios concurrentes")
    ax1.set_ylabel("average response time (ms)", color="tab:blue")
    ax1.tick_params(axis="y", labelcolor="tab:blue")
    ax2 = ax1.twinx()
    ax2.plot(xs, errs, "s--", color="tab:orange", label="% sobre umbral")
    ax2.set_ylabel("% muestras sobre el umbral", color="tab:orange")
    ax2.tick_params(axis="y", labelcolor="tab:orange")
    plt.title(f"Punto de quiebre - {plan} (average y % error vs. carga)")
    ax1.grid(True, alpha=0.3)
    fig.tight_layout()
    out = HERE / f"breakpoint-{plan}.png"
    plt.savefig(out, dpi=110)
    plt.close()
    print(f"  {out.name}: niveles={xs}  avg={[round(a) for a in avgs]}  %err={[round(e,2) for e in errs]}")


if __name__ == "__main__":
    print("== /login (prueba ejecutada) ==")
    levels = (20, 50, 100, 200)
    for n in levels:
        over_time("login", n)
    breakpoint("login", levels)
    print("Listo.")
