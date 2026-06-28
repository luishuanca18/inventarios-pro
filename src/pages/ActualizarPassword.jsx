import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { supabase } from "../supabase/supabase.config.jsx";
import { traducirMensajeAuth } from "../utils/authMensajes";

export function ActualizarPassword() {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const navigate = useNavigate();

  const guardarNuevaPassword = async () => {
    if (!password || password.length < 6) {
      setMensaje("La nueva contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== password2) {
      setMensaje("Las contrasenas no coinciden.");
      return;
    }

    try {
      setGuardando(true);
      setMensaje("");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMensaje("Contrasena actualizada. Ahora ya puedes entrar con tu nueva clave.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (error) {
      setMensaje(
        traducirMensajeAuth(error?.message || "No se pudo actualizar la contrasena."),
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Contenedor>
      <div className="card">
        <h1>Actualizar contrasena</h1>
        <p>
          Si llegaste aqui desde el correo de recuperacion, escribe tu nueva contrasena
          y guardala.
        </p>

        <label>Nueva contrasena</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label>Repetir contrasena</label>
        <input
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
        />

        {mensaje ? <div className="mensaje">{mensaje}</div> : null}

        <div className="acciones">
          <Link to="/login" className="btn secundario">
            Volver
          </Link>
          <button type="button" className="btn principal" onClick={guardarNuevaPassword} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar contrasena"}
          </button>
        </div>
      </div>
    </Contenedor>
  );
}

const Contenedor = styled.div`
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #1f1f1f;
  padding: 24px;

  .card {
    width: min(520px, 100%);
    background: #ffffff;
    color: #111111;
    border-radius: 18px;
    padding: 28px;
    display: grid;
    gap: 12px;
  }

  h1,
  p {
    margin: 0;
  }

  p,
  .mensaje {
    color: #5c5c66;
    line-height: 1.5;
  }

  label {
    font-weight: 700;
    margin-top: 8px;
  }

  input {
    border: 1px solid #d6d6df;
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 14px;
    outline: none;
  }

  .acciones {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .btn {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .principal {
    background: #750198;
    color: #ffffff;
  }

  .secundario {
    background: #e7e7ee;
    color: #111111;
  }
`;
