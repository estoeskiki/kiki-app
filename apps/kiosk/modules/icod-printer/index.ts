import { requireNativeModule } from 'expo-modules-core';

// Require the native module. 
// "IcodPrinter" maps to Name("IcodPrinter") in the Kotlin module definition.
const IcodPrinter = requireNativeModule('IcodPrinter');

export async function initPrinter(): Promise<boolean> {
  return await IcodPrinter.initPrinter();
}

export async function printString(text: string): Promise<boolean> {
  return await IcodPrinter.printString(text);
}

export async function printQRCode(text: string, modeSize: number = 6): Promise<boolean> {
  return await IcodPrinter.printQRCode(text, modeSize);
}

export async function cutPaper(): Promise<boolean> {
  return await IcodPrinter.cutPaper();
}

export async function disconnect(): Promise<boolean> {
  return await IcodPrinter.disconnect();
}
