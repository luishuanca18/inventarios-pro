import styled from "styled-components";
import { useState } from "react";
import Swal from "sweetalert2";
import { v } from "../../../styles/variables";
import { InputText, Btnsave, useUsuariosStore } from "../../../index";
import { useForm } from "react-hook-form";
import { MdAlternateEmail } from "react-icons/md";
import {
  RiEyeLine,
  RiEyeOffLine,
  RiLockPasswordLine,
} from "react-icons/ri";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

export function RegistrarAdmin({ setState }) {
  const { insertarUsuarioAdmin } = useUsuariosStore();
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm();

  const mutation = useMutation({
    mutationFn: async (data) => {
      const respuesta = await insertarUsuarioAdmin({
        correo: data.correo,
        pass: data.pass,
        tipouser: "admin",
      });

      if (!respuesta?.ok) {
        throw new Error(
          respuesta?.message ?? "No se pudo crear la cuenta en este momento.",
        );
      }

      return respuesta;
    },
    onSuccess: async (respuesta) => {
      await Swal.fire({
        icon: "success",
        title: "Cuenta creada",
        text: respuesta?.requiereConfirmacionCorreo
          ? "La cuenta se guardo en usuarios. Si luego no te deja ingresar, revisa si Supabase esta pidiendo confirmar el correo."
          : "La cuenta se guardo correctamente en la tabla usuarios.",
        confirmButtonColor: "#910eb9",
      });

      navigate("/");
    },
    onError: async (error) => {
      await Swal.fire({
        icon: "error",
        title: "No se pudo crear la cuenta",
        text:
          error?.message ??
          "Ocurrio un problema al registrar la cuenta. Revisa los datos e intenta otra vez.",
        confirmButtonColor: "#910eb9",
      });
    },
  });

  return (
    <Container>
      <ContentClose>
        <span onClick={setState}>x</span>
      </ContentClose>
      <section className="subcontainer">
        <div className="headers">
          <section>
            <h1>Registrar usuario</h1>
          </section>
        </div>

        <form
          className="formulario"
          onSubmit={handleSubmit(mutation.mutateAsync)}
        >
          <section>
            <article>
              <InputText icono={<MdAlternateEmail />} colorTexto="#202020">
                <input
                  className="form__field"
                  style={{ textTransform: "lowercase" }}
                  type="text"
                  placeholder="correo"
                  {...register("correo", {
                    required: true,
                    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/i,
                  })}
                />
                <label className="form__label">email</label>
                {errors.correo?.type === "pattern" && (
                  <p>El formato del email es incorrecto</p>
                )}
                {errors.correo?.type === "required" && <p>Campo requerido</p>}
              </InputText>
            </article>

            <article>
              <InputText icono={<RiLockPasswordLine />} colorTexto="#202020">
                <div className="passwordField">
                  <input
                    className="form__field"
                    type={mostrarPassword ? "text" : "password"}
                    placeholder="pass"
                    {...register("pass", {
                      required: true,
                      minLength: 6,
                    })}
                  />
                  <button
                    className="togglePassword"
                    type="button"
                    onClick={() => setMostrarPassword((estado) => !estado)}
                    aria-label={
                      mostrarPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    {mostrarPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                  </button>
                </div>
                <label className="form__label">pass</label>
                {errors.pass?.type === "required" && <p>Campo requerido</p>}
                {errors.pass?.type === "minLength" && (
                  <p>La contraseña debe tener al menos 6 caracteres</p>
                )}
              </InputText>
            </article>

            <div className="btnguardarContent">
              <Btnsave
                icono={<v.iconoguardar />}
                titulo={mutation.isPending ? "Guardando..." : "Guardar"}
                bgcolor="#910eb9"
              />
            </div>
          </section>
        </form>
      </section>
    </Container>
  );
}

const Container = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
  border-radius: 20px;
  background: #fff;
  box-shadow: -10px 15px 30px rgba(10, 9, 9, 0.4);
  padding: 13px 36px 20px 36px;
  z-index: 100;
  display: flex;
  align-items: center;

  .subcontainer {
    width: 100%;
  }

  .headers {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h1 {
      font-size: 20px;
      font-weight: 500;
    }

    span {
      font-size: 20px;
      cursor: pointer;
    }
  }

  .formulario {
    section {
      gap: 20px;
      display: flex;
      flex-direction: column;

      .colorContainer {
        .colorPickerContent {
          padding-top: 15px;
          min-height: 50px;
        }
      }
    }
  }

  .passwordField {
    position: relative;
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
`;

const ContentClose = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  font-size: 33px;
  margin: 30px;
  cursor: pointer;
`;
