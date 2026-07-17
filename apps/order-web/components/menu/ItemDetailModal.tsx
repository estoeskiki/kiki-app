'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { CustomizationGroup, MenuItem } from '@/lib/types';
import { formatCurrency, localize } from '@/lib/currency';
import { getPlateColor } from '@/lib/plateColor';
import { useCartStore } from '@/store/useCartStore';

interface ItemDetailModalProps {
  item: MenuItem;
  restaurantId: string;
  restaurantName: string;
  onClose: () => void;
}

// How many options this group currently allows. With a selectionRule the cap
// follows the option picked in the driver group (e.g. 5 tenders -> 1 sauce,
// 8/12 -> 2); without one it's the static maxSelections. Never exceeds the
// static ceiling.
function effectiveMax(group: CustomizationGroup, selected: Record<string, string[]>): number {
  const rule = group.selectionRule;
  if (!rule) return group.maxSelections;
  const driverOption = (selected[rule.driverGroupId] ?? [])[0];
  const ruleMax = driverOption ? rule.byOption[driverOption] ?? rule.defaultMax : rule.defaultMax;
  return Math.min(ruleMax, group.maxSelections);
}

export function ItemDetailModal({ item, restaurantId, restaurantName, onClose }: ItemDetailModalProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of item.customizations) init[g.id] = [];
    return init;
  });
  const [quantity, setQuantity] = useState(1);

  // Without this, the fixed-position overlay doesn't stop the page behind it
  // from scrolling — on touch devices the drag gesture can hit the menu grid
  // underneath instead of this modal's own scroll area.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const toggleOption = useCallback(
    (group: CustomizationGroup, optionId: string) => {
      setSelected((prev) => {
        const maxSel = effectiveMax(group, prev);
        const current = prev[group.id] ?? [];
        let next: Record<string, string[]>;
        if (maxSel === 1) {
          if (current.includes(optionId) && !group.required) next = { ...prev, [group.id]: [] };
          else next = { ...prev, [group.id]: [optionId] };
        } else if (current.includes(optionId)) {
          next = { ...prev, [group.id]: current.filter((id) => id !== optionId) };
        } else if (current.length >= maxSel) {
          next = { ...prev, [group.id]: [...current.slice(1), optionId] };
        } else {
          next = { ...prev, [group.id]: [...current, optionId] };
        }
        // Changing a driver option can shrink a dependent group's cap (e.g.
        // switching 12 -> 5 tenders drops the allowance from 2 sauces to 1).
        // Trim any group this one drives down to its new effective max.
        for (const g of item.customizations) {
          if (g.selectionRule?.driverGroupId === group.id) {
            const gMax = effectiveMax(g, next);
            const cur = next[g.id] ?? [];
            if (cur.length > gMax) next = { ...next, [g.id]: cur.slice(0, gMax) };
          }
        }
        return next;
      });
    },
    [item.customizations],
  );

  const modifierTotal = useMemo(() => {
    let total = 0;
    for (const g of item.customizations) {
      const ids = selected[g.id] ?? [];
      for (const opt of g.options) if (ids.includes(opt.id)) total += opt.priceModifier;
    }
    return total;
  }, [item.customizations, selected]);

  const lineTotal = (item.price + modifierTotal) * quantity;

  const canAdd = useMemo(
    () => item.customizations.every((g) => !g.required || (selected[g.id] ?? []).length > 0),
    [item.customizations, selected],
  );

  const handleAdd = () => {
    if (!canAdd) return;
    addItem(item, quantity, selected, restaurantId, restaurantName);
    onClose();
  };

  const initial = localize(item.name).trim().charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="relative flex max-h-[75vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-background sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text-primary shadow"
        >
          ✕
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative flex h-52 items-center justify-center" style={{ backgroundColor: getPlateColor(item.id) }}>
            {item.image ? (
              <Image src={item.image} alt="" fill sizes="(min-width: 640px) 512px, 100vw" className="object-cover" />
            ) : (
              <span className="font-heading text-8xl font-black text-text-secondary/20">{initial}</span>
            )}
            {item.popular && (
              <span className="absolute bottom-3 left-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-on-primary">
                ★ Popular
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 px-5 pb-8 pt-5">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-text-primary">{localize(item.name)}</h2>
            <p className="font-body text-text-muted">{localize(item.description)}</p>
            <p className="font-heading text-xl font-bold text-text-primary">{formatCurrency(item.price)}</p>

            {item.customizations.map((group) => {
              const maxSel = effectiveMax(group, selected);
              const isRadio = maxSel === 1;
              return (
              <div key={group.id} className="mt-4 border-t border-border-light pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="flex-1 font-heading text-base font-semibold tracking-tight text-text-primary">
                    {localize(group.name)}
                  </h3>
                  {group.required && (
                    <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold text-on-primary">Obligatorio</span>
                  )}
                  {maxSel > 1 && (
                    <span className="text-sm text-text-muted">Hasta {maxSel}</span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {group.options.map((option) => {
                    const isSelected = (selected[group.id] ?? []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleOption(group, option.id)}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                          isSelected ? 'border-primary bg-primary/10' : 'border-border-light bg-surface'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 text-[10px] font-black ${
                            isRadio ? 'rounded-full' : 'rounded'
                          } ${isSelected ? 'border-primary bg-primary text-on-primary' : 'border-border'}`}
                        >
                          {isSelected && (isRadio ? <span className="h-2 w-2 rounded-full bg-on-primary" /> : '✓')}
                        </span>
                        <span className={`flex-1 font-body text-sm ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {localize(option.name)}
                        </span>
                        {option.priceModifier !== 0 && (
                          <span className="font-body text-sm font-semibold text-text-muted">
                            {option.priceModifier > 0 ? '+' : ''}
                            {formatCurrency(option.priceModifier)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border-light bg-surface p-4">
          <div className="flex items-center gap-4 rounded-full bg-surface-container px-2">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="flex h-11 w-11 items-center justify-center text-xl text-text-primary disabled:opacity-30"
            >
              −
            </button>
            <span className="min-w-6 text-center font-heading text-lg font-bold text-text-primary">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-11 w-11 items-center justify-center text-xl text-text-primary"
            >
              +
            </button>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="h-14 flex-1 rounded-lg bg-primary font-heading text-base font-bold text-on-primary transition active:scale-[0.98] disabled:opacity-40"
          >
            Agregar — {formatCurrency(lineTotal)}
          </button>
        </div>
      </div>
    </div>
  );
}
