export const enfocarCampoValidacion = (clave = "") => {
  if (!clave || typeof document === "undefined") {
    return;
  }

  const contenedor = document.querySelector(
    `[data-campo-validacion="${clave}"]`,
  );

  if (!contenedor) {
    return;
  }

  contenedor.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  const objetivo = contenedor.querySelector(
    "input:not([readonly]), select:not([readonly]), textarea:not([readonly]), button, [tabindex]",
  );

  if (objetivo && typeof objetivo.focus === "function") {
    window.setTimeout(() => {
      try {
        objetivo.focus({ preventScroll: true });
      } catch {
        objetivo.focus();
      }
    }, 180);
  }
};
