import { v } from "../styles/variables";
import { AiOutlineHome, AiOutlineSetting } from "react-icons/ai";

export const DesplegableUser = [
  {
    text: "Mi perfil",
    icono: <v.iconoUser />,
    tipo: "miperfil",
  },
  {
    text: "Configuracion",
    icono: <v.iconoSettings />,
    tipo: "configuracion",
  },
  {
    text: "Cerrar sesion",
    icono: <v.iconoCerrarSesion />,
    tipo: "cerrarsesion",
  },
];

// data SIDEBAR
export const LinksArray = [
  {
    label: "Inicio",
    icon: <AiOutlineHome />,
    to: "/",
  },
  {
    label: "Produccion",
    icon: <v.iconoproduccion />,
    to: "/produccion",
  },
  {
    label: "Talleres",
    icon: <v.iconotalleres />,
    to: "/talleres",
  },
  {
    label: "Mat. prima",
    icon: <v.iconoMateriaPrima />,
    to: "/almacen/materia-prima",
  },
  {
    label: "Prod. terminados",
    icon: <v.iconoAlmancenPrendas />,
    to: "/almacen/producto-terminado",
  },
  {
    label: "Tiendas",
    icon: <v.iconotiendas />,
    to: "/tiendas",
  },
  {
    label: "Contabilidad",
    icon: <v.iconoContabilidad />,
    to: "/contabilidad",
  },
  {
    label: "Rec. humanos",
    icon: <v.iconoRecursosHumanos />,
    to: "/recursos-humanos",
  },
  {
    label: "Reportes",
    icon: <v.iconoreportes />,
    to: "/reportes",
  },
];

export const SecondarylinksArray = [
  {
    label: "Configuracion",
    icon: <AiOutlineSetting />,
    to: "/configurar",
  },
];

// temas
export const TemasData = [
  {
    icono: "light",
    descripcion: "light",
  },
  {
    icono: "dark",
    descripcion: "dark",
  },
];

// data configuracion
export const DataModulosConfiguracion = [
  {
    title: "Productos",
    subtitle: "registra tus productos",
    icono: "https://i.ibb.co/85zJ6yG/caja-del-paquete.png",
    link: "/configurar/productos",
  },
  {
    title: "Personal",
    subtitle: "ten el control de tu personal",
    icono: "https://i.ibb.co/5vgZ0fX/hombre.png",
    link: "/configurar/usuarios",
  },
  {
    title: "Tu empresa",
    subtitle: "configura tus opciones basicas",
    icono: "https://i.ibb.co/x7mHPgm/administracion-de-empresas.png",
    link: "/configurar/empresa",
  },
  {
    title: "Categoria de productos",
    subtitle: "asigna categorias a tus productos",
    icono: "https://i.ibb.co/VYbMRLZ/categoria.png",
    link: "/configurar/categorias",
  },
  {
    title: "Marca de productos",
    subtitle: "gestiona tus marcas",
    icono: "https://i.ibb.co/1qsbCRb/piensa-fuera-de-la-caja.png",
    link: "/configurar/marca",
  },
];

// tipo usuario
export const TipouserData = [
  {
    descripcion: "empleado",
    icono: "empleado",
  },
  {
    descripcion: "administrador",
    icono: "administrador",
  },
];

// tipodoc
export const TipoDocData = [
  {
    descripcion: "Dni",
    icono: "dni",
  },
  {
    descripcion: "Libreta electoral",
    icono: "libreta",
  },
  {
    descripcion: "Otros",
    icono: "otros",
  },
];
