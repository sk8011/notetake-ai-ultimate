import { useState, useEffect } from "react";
import { Container, Form, Button, Card, Alert } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    if (password.length < 6) {
      return setError("Password must be at least 6 characters");
    }

    setError("");
    setLoading(true);

    try {
      await register(email, password, name);
    } catch (err: any) {
      console.error("Failed to register:", err);
      setError(err.response?.data?.error || "Failed to register");
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <div className="w-100" style={{ maxWidth: "420px" }}>
        <div className="text-center mb-4">
          <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>Create Account</h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem" }}>Get started with NoteGPT today</p>
        </div>
        <Card style={{ border: "none", boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)" }}>
          <Card.Body style={{ padding: "2rem" }}>
            {error && <Alert variant="danger" style={{ borderRadius: "8px" }}>{error}</Alert>}
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ padding: "0.75rem 1rem" }}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ padding: "0.75rem 1rem" }}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ padding: "0.75rem 1rem" }}
                />
                <Form.Text className="text-muted" style={{ fontSize: "0.8rem" }}>
                  Minimum 6 characters
                </Form.Text>
              </Form.Group>
              <Form.Group className="mb-4">
                <Form.Label>Confirm Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ padding: "0.75rem 1rem" }}
                />
              </Form.Group>
              <Button disabled={loading} className="w-100" type="submit" style={{ padding: "0.75rem" }}>
                {loading ? (
                  <span>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Creating account...
                  </span>
                ) : (
                  <>
                    <i className="bi bi-person-plus me-2"></i>
                    Create Account
                  </>
                )}
              </Button>
            </Form>
            <div className="w-100 text-center mt-4" style={{ color: "#64748b" }}>
              Already have an account?{" "}
              <Link to="/login" style={{ color: "#6366f1", textDecoration: "none", fontWeight: "500" }}>
                Sign in
              </Link>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}
