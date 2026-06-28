const CLAVE_PAGINACION_SISTEMA = "cynara_paginacion_sistema";

export const FILAS_POR_PAGINA_POR_DEFECTO = 10;
export const OPCIONES_FILAS_POR_PAGINA = [5, 10, 15, 20, 30, 50];

const normalizarFilasPorPagina = (valor) => {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    return FILAS_POR_PAGINA_POR_DEFECTO;
  }

  return Math.max(1, Math.round(numero));
};

export const leerFilasPorPaginaSistema = () => {
  if (typeof window === "undefined") {
    return FILAS_POR_PAGINA_POR_DEFECTO;
  }

  const contenido = localStorage.getItem(CLAVE_PAGINACION_SISTEMA);

  if (!contenido) {
    return FILAS_POR_PAGINA_POR_DEFECTO;
  }

  try {
    const data = JSON.parse(contenido);
    return normalizarFilasPorPagina(data?.filasPorPagina);
  } catch {
    return FILAS_POR_PAGINA_POR_DEFECTO;
  }
};

export const guardarFilasPorPaginaSistema = (valor) => {
  const filasPorPagina = normalizarFilasPorPagina(valor);

  if (typeof window !== "undefined") {
    localStorage.setItem(
      CLAVE_PAGINACION_SISTEMA,
      JSON.stringify({ filasPorPagina })
    );
  }

  return filasPorPagina;
};
