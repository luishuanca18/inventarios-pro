import styled from "styled-components";
import {
  Btnsave,
  v,
  useAuthStore,
  InputText,
  FooterLogin,
} from "../../index";
import { Device } from "../../styles/breackpoints";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import carrito from "../../assets/carrito.png";
import logo from "../../assets/inventarioslogo.png";
import { MdOutlineInfo } from "react-icons/md";
import { RiEyeLine, RiEyeOffLine } from "react-icons/ri";
import { traducirMensajeAuth } from "../../utils/authMensajes";
import { supabase } from "../../supabase/supabase.config.jsx";

export function LoginTemplate() {
  const { signInWithEmail } = useAuthStore();
  const [mensajeInicio, setMensajeInicio] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mensajeRecuperacion, setMensajeRecuperacion] = useState("");
  const navigate = useNavigate();

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm({
    defaultValues: {
      correo: "",
      pass: "",
    },
  });

  async function iniciar(data) {
    setMensajeRecuperacion("");
    const response = await signInWithEmail({
      correo: data.correo,
      pass: data.pass,
    });

    if (response?.ok) {
      setMensajeInicio("");
      navigate("/");
    } else {
      setMensajeInicio(
        traducirMensajeAuth(
          response?.message ||
          "No se pudo ingresar. Revisa tus datos o solicita acceso al administrador.",
        ),
      );
    }
  }

  async function recuperarPassword() {
    const correo = window.prompt("Escribe el correo de la cuenta para enviarte el enlace de recuperacion:");
    if (!correo) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(correo.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/actualizar-password`,
      });
      if (error) throw error;
      setMensajeRecuperacion("Se envio un correo para restablecer la contrasena.");
    } catch (error) {
      setMensajeRecuperacion(
        traducirMensajeAuth(
          error?.message || "No se pudo enviar el correo de recuperacion.",
        ),
      );
    }
  }

  return (
    <Container>
      <div className="contentLogo">
        <img src={logo}></img>
        <span>ERP LHM V0.1</span>
      </div>
      <div className="bannerlateral">
        <img src={carrito}></img>
      </div>

      <div className="contentCard">
        <div className="card">
          <Titulo>Corporacion Cynara</Titulo>
          {mensajeInicio ? <TextoStateInicio>{mensajeInicio}</TextoStateInicio> : null}
          {mensajeRecuperacion ? (
            <TextoStateInicio>{mensajeRecuperacion}</TextoStateInicio>
          ) : null}
          <span className="ayuda">
            Solicita tu cuenta al administrador del sistema.{" "}
            <MdOutlineInfo />
          </span>
          <p className="frase">MODA URBANA.</p>

          <form onSubmit={handleSubmit(iniciar)}>
            <InputText icono={<v.iconoemail />} colorTexto="#111111">
              <input
                className="form__field"
                type="text"
                placeholder="correo o nombre visible"
                {...register("correo", {
                  required: true,
                })}
              />
              <label className="form__label">correo o nombre</label>
              {errors.correo?.type === "required" && <p>Campo requerido</p>}
            </InputText>

            <InputText icono={<v.iconopass />} colorTexto="#111111">
              <div className="passwordField">
                <input
                  className="form__field"
                  type={mostrarPassword ? "text" : "password"}
                  placeholder="contrasena"
                  {...register("pass", {
                    required: true,
                  })}
                />
                <button
                  className="togglePassword"
                  type="button"
                  onClick={() => setMostrarPassword((estado) => !estado)}
                  aria-label={
                    mostrarPassword
                      ? "Ocultar contrasena"
                      : "Mostrar contrasena"
                  }
                >
                  {mostrarPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                </button>
              </div>
              <label className="form__label">contrasena</label>
              {errors.pass?.type === "required" && <p>Campo requerido</p>}
            </InputText>

            <ContainerBtn>
              <Btnsave titulo="Iniciar" bgcolor="#750198" type="submit" />
            </ContainerBtn>
            <div className="recuperar">
              <button type="button" onClick={recuperarPassword}>
                Olvide mi contrasena
              </button>
            </div>
          </form>
        </div>
        <FooterLogin />
      </div>
    </Container>
  );
}

const Container = styled.div`
  background-size: cover;
  height: 100vh;
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  justify-content: center;
  text-align: center;
  background-color: #262626;

  @media ${Device.tablet} {
    grid-template-columns: 1fr 2fr;
  }

  .contentLogo {
    position: absolute;
    top: 15px;
    font-weight: 700;
    display: flex;
    left: 15px;
    align-items: center;
    color: #fff;

    img {
      width: 50px;
    }
  }

  .cuadros {
    transition: cubic-bezier(0.4, 0, 0.2, 1) 0.6s;
    position: absolute;
    height: 100%;
    width: 100%;
    bottom: 0;
    transition: 0.6s;
  }

  .bannerlateral {
    background-color: #740098;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 80%;
    }
  }

  .contentCard {
    grid-column: 2;
    background-color: #ffffff;
    background-size: cover;
    z-index: 100;
    position: relative;
    gap: 30px;
    display: flex;
    padding: 20px;
    box-shadow: 8px 5px 18px 3px rgba(0, 0, 0, 0.35);
    justify-content: center;
    width: auto;
    height: 100%;
    width: 100%;
    align-items: center;
    flex-direction: column;
    justify-content: space-between;

    .card {
      padding-top: 80px;
      width: 100%;

      @media ${Device.laptop} {
        width: 50%;
      }
    }

    .version {
      color: #727272;
      text-align: start;
    }

    .contentImg {
      width: 100%;
      display: flex;
      justify-content: center;

      img {
        width: 40%;
        animation: flotar 1.5s ease-in-out infinite alternate;
      }
    }

    .frase {
      color: #740098;
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 30px;
    }

    .ayuda {
      position: absolute;
      top: 15px;
      right: 15px;
      color: #8d8d8d;
      font-size: 15px;
      font-weight: 500;
    }

    &:hover {
      .contentsvg {
        top: -100px;
        opacity: 1;
      }

      .cuadros {
        transform: rotate(37deg) rotateX(5deg) rotateY(12deg) rotate(3deg)
          skew(2deg) skewY(1deg) scaleX(1.2) scaleY(1.2);
        color: red;
      }
    }
  }

  .passwordField {
    position: relative;
  }

  .recuperar {
    margin-top: 12px;
    display: flex;
    justify-content: center;
  }

  .recuperar button {
    border: none;
    background: transparent;
    color: #740098;
    font-weight: 700;
    cursor: pointer;
  }

  .togglePassword {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    color: #5b5b5b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    font-size: 19px;
  }

  @keyframes flotar {
    0% {
      transform: translate(0, 0px);
    }
    50% {
      transform: translate(0, 15px);
    }
    100% {
      transform: translate(0, -0px);
    }
  }
`;

const Titulo = styled.span`
  font-size: 3rem;
  font-weight: 700;
`;

const ContainerBtn = styled.div`
  margin-top: 15px;
  display: flex;
  justify-content: center;
`;

const TextoStateInicio = styled.p`
  color: #740098;
`;
