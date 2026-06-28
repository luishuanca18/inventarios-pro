import { css } from "styled-components";

export const tabletLandscapeBase = css`
  @media (min-width: 768px) and (max-width: 1366px) {
    padding: 12px;
    gap: 12px;

    .encabezado {
      border-radius: 14px;
      padding-right: 8px;
    }

    .cabecera,
    .tarjeta,
    .hero,
    .bloque {
      padding: 16px;
      border-radius: 14px;
    }

    .cabecera h1,
    .hero h1 {
      font-size: clamp(28px, 3vw, 34px);
    }

    .cabecera__estado {
      padding: 12px 14px;
      border-radius: 12px;
    }

    .cabecera__estado strong {
      font-size: 22px;
    }

    .fila_superior,
    .tarjeta__encabezado,
    .acciones,
    .acciones_tabla,
    .paginacion,
    .navegacion_superior {
      gap: 10px;
    }

    .boton_volver,
    .btn,
    .submodulo_link {
      min-height: 40px;
      padding: 10px 12px;
      font-size: 13px;
    }

    .pestanas {
      gap: 8px;
      padding: 8px;
    }

    .pestana {
      padding: 9px 14px;
      font-size: 13px;
    }

    .resumen__grid {
      gap: 10px;
    }

    .resumen__grid strong {
      font-size: 16px;
    }

    th,
    td {
      padding: 8px 7px;
      font-size: 12px;
    }

    th {
      font-size: 12px;
      line-height: 1.25;
    }
  }
`;

export const tabletLandscapeTableCompact = css`
  @media (min-width: 768px) and (max-width: 1366px) {
    table {
      min-width: 980px;
    }

    .tabla_contenedor,
    .tabla_listview {
      overflow-x: auto;
    }

    input,
    select,
    textarea {
      font-size: 13px;
    }
  }
`;

export const mobileStackBase = css`
  @media (max-width: 860px) {
    .grid-2,
    .grid-3,
    .resumen__grid {
      grid-template-columns: 1fr;
    }

    .fila_superior,
    .tarjeta__encabezado,
    .acciones,
    .acciones_tabla,
    .navegacion_superior,
    .paginacion {
      flex-direction: column;
      align-items: stretch;
    }

    .boton_volver,
    .btn,
    .submodulo_link {
      width: 100%;
    }
  }
`;
