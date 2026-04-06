export const translations = {
  es: {
    // Welcome Screen
    welcome: 'Bienvenido',
    startOrder: 'Comenzar Orden',
    poweredBy: 'Potenciado por ',
    selectLanguage: 'Seleccionar Idioma',

    // Order Type Screen
    chooseOrderType: 'Elige tu tipo de orden',
    dineIn: 'Comer Aquí',
    dineInSub: 'Para disfrutar en el restaurante',
    takeaway: 'Para Llevar',
    takeawaySub: 'Para llevar contigo',

    // Menu / General
    menu: 'Menú',
    addToCart: 'Agregar',
    updateCart: 'Actualizar',

    // Cart / Checkout
    yourOrder: 'Tu Orden',
    emptyCartTitle: 'Tu carrito está vacío',
    emptyCartSub: 'Agrega artículos del menú para comenzar',
    browseMenu: 'Ver Menú',
    viewCart: 'Ver Carrito',
    orderLabel: 'ORDEN',
    subtotal: 'Subtotal',
    tax: 'Impuestos',
    total: 'Total',
    continueToCheckout: 'Ir al Pago',

    // Checkout
    reviewOrder: 'Revisar Orden',
    editOrder: 'Editar Orden',
    placeOrder: 'Confirmar Orden',
    checkout: 'Checkout',
    customerName: 'Tu Nombre',
    enterName: 'Ingresa tu nombre para la orden',
    payNow: 'Pagar Ahora',
    cancel: 'Cancelar',
    startNewOrder: 'Nueva Orden',
    startNewOrderConfirm: 'Esto borrará tu carrito actual y comenzará de nuevo.',
    confirmRestart: 'Reiniciar',

    // Payment / Success
    processing: 'Procesando pago...',
    paymentInstructions: 'Por favor, sigue las instrucciones de la terminal',
    paymentSuccess: '¡Pago Exitoso!',
    preparingOrder: 'Preparando tu orden...',
    paymentFailed: 'Pago Fallido',
    paymentDeclined: 'El pago fue rechazado.',
    unexpectedError: 'Ocurrió un error inesperado. Por favor intenta de nuevo.',
    tryAgain: 'Intentar de Nuevo',
    thankYou: '¡Gracias,',
    thankYouSuccess: '¡Gracias!',
    orderNumber: 'Tu número de orden es',
    estimatedWait: 'Tiempo de espera: 5–10 minutos',
    printReceipt: 'Imprimir Recibo',
    printing: 'Imprimiendo...',
    printed: '¡Recibo Impreso!',
    startNewOrderCountdown: 'Nueva Orden en',
    autoResetHint: 'Reinicio automático en',
  },
  en: {
    // Welcome Screen
    welcome: 'Welcome',
    startOrder: 'Start Your Order',
    poweredBy: 'Powered by ',
    selectLanguage: 'Select Language',

    // Order Type Screen
    chooseOrderType: 'Choose your order type',
    dineIn: 'Dine In',
    dineInSub: 'Eat at the restaurant',
    takeaway: 'Takeaway',
    takeawaySub: 'Take your order to go',

    // Menu / General
    menu: 'Menu',
    addToCart: 'Add to Cart',
    updateCart: 'Update Cart',

    // Cart / Checkout
    yourOrder: 'Your Order',
    emptyCartTitle: 'Your cart is empty',
    emptyCartSub: 'Add items from the menu to get started',
    browseMenu: 'Browse Menu',
    viewCart: 'View Cart',
    orderLabel: 'ORDER',
    subtotal: 'Subtotal',
    tax: 'Tax',
    total: 'Total',
    continueToCheckout: 'Continue to Checkout',

    // Checkout
    reviewOrder: 'Review Order',
    editOrder: 'Edit Order',
    placeOrder: 'Place Order',
    checkout: 'Checkout',
    customerName: 'Your Name',
    enterName: 'Enter your name for the order',
    payNow: 'Pay Now',
    cancel: 'Cancel',
    startNewOrder: 'Start New Order',
    startNewOrderConfirm: 'This will clear your current cart and start fresh.',
    confirmRestart: 'Restart',

    // Payment / Success
    processing: 'Processing payment...',
    paymentInstructions: 'Please follow the instructions on the terminal',
    paymentSuccess: 'Payment Successful!',
    preparingOrder: 'Preparing your order...',
    paymentFailed: 'Payment Failed',
    paymentDeclined: 'Payment was declined.',
    unexpectedError: 'An unexpected error occurred. Please try again.',
    tryAgain: 'Try Again',
    thankYou: 'Thank you,',
    thankYouSuccess: 'Thank You!',
    orderNumber: 'Your order number is',
    estimatedWait: 'Estimated wait: 5–10 minutes',
    printReceipt: 'Print Receipt',
    printing: 'Printing...',
    printed: 'Receipt Printed!',
    startNewOrderCountdown: 'Start New Order',
    autoResetHint: 'Auto-reset in',
  }
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations['en'];
