export const mockPrintTicket = async (orderNumber: number): Promise<boolean> => {
  return new Promise((resolve) => {
    // Simulate printer delay
    setTimeout(() => {
      console.log(`[PRINTER] Successfully printed ticket for Order #${orderNumber}`);
      resolve(true);
    }, 1500);
  });
};
