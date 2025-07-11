export const validateBarRegistration = (formData: any) => {
  const errors: string[] = [];

  // Step 1 validations
  if (!formData.name?.trim()) {
    errors.push('El nombre del bar es requerido');
  }

  if (!formData.description?.trim()) {
    errors.push('La descripción es requerida');
  }

  if (!formData.phone?.trim()) {
    errors.push('El teléfono es requerido');
  } else if (!/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
    errors.push('El formato del teléfono no es válido');
  }

  if (!formData.categoryId) {
    errors.push('La categoría es requerida');
  }

  // Step 3 validations
  if (!formData.address?.trim()) {
    errors.push('La dirección es requerida');
  }

  if (!formData.city?.trim()) {
    errors.push('La ciudad es requerida');
  }

  if (!formData.postalCode?.trim()) {
    errors.push('El código postal es requerido');
  } else if (!/^\d{5}$/.test(formData.postalCode)) {
    errors.push('El código postal debe tener 5 dígitos');
  }

  // Coordinate validations (optional but if provided, must be valid)
  if (formData.latitude && (formData.latitude < -90 || formData.latitude > 90)) {
    errors.push('La latitud debe estar entre -90 y 90');
  }

  if (formData.longitude && (formData.longitude < -180 || formData.longitude > 180)) {
    errors.push('La longitud debe estar entre -180 y 180');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 9;
};

export const validateWebsite = (website: string): boolean => {
  if (!website) return true; // Optional field
  
  try {
    new URL(website);
    return true;
  } catch {
    return false;
  }
};

export const validatePostalCode = (postalCode: string): boolean => {
  return /^\d{5}$/.test(postalCode);
};

export const validateCoordinates = (lat: number, lng: number): boolean => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}; 