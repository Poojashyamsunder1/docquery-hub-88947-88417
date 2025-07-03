import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import "./App.css";

// PUBLIC_INTERFACE
function App() {
  // Supabase configuration
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL ||
    "https://sirvwsslwxxxuysywyan.supabase.co";
  const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcnZ3c3Nsd3h4eHV5c3l3eWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MDk1NTgsImV4cCI6MjA2NzA4NTU1OH0.DfGb7i74DGejUnKuzKDiubyM2OsL_Qx0QIYtaZPiwos";
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Auth State
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState("sign_in"); // sign_up or sign_in
  const [authError, setAuthError] = useState("");
  const [authProcessing, setAuthProcessing] = useState(false);

  // Auth form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // File Upload State
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);

  // PDF Preview State
  // (preview not available; see comment in render area)

  // Q&A Chat State
  const [chatHistory, setChatHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [qaProcessing, setQaProcessing] = useState(false);
  const chatEndRef = useRef(null);

  // Theme state
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  // Scroll chat to bottom on update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  // PUBLIC_INTERFACE
  useEffect(() => {
    // Initial session check
    const getSession = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
      else setUser(null);
    };

    getSession();

    // Auth state change subscription
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line
  }, []);

  // PUBLIC_INTERFACE
  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthProcessing(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setAuthProcessing(false);
  };

  // PUBLIC_INTERFACE
  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthProcessing(true);

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    else setAuthView("sign_in");
    setAuthProcessing(false);
  };

  // PUBLIC_INTERFACE
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUploadedFileUrl(null);
    setUploadedFileName(null);
    setPdfFile(null);
    setChatHistory([]);
  };

  // PUBLIC_INTERFACE
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    } else {
      setPdfFile(null);
      alert("Please select a valid PDF file");
    }
  };

  // PUBLIC_INTERFACE
  const handleFileUpload = async () => {
    if (!pdfFile) return;
    setUploading(true);
    setUploadedFileUrl(null);
    setUploadedFileName(null);

    try {
      // User-specific bucket path
      const fileExt = pdfFile.name.split(".").pop();
      const fileName = `${user.id}/${uuidv4()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from("uploads")
        .upload(fileName, pdfFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(fileName);

      setUploadedFileName(pdfFile.name);
      setUploadedFileUrl(urlData.publicUrl);

      // Optionally, send file info to backend for processing
      await fetch(`${process.env.REACT_APP_BACKEND_API_URL || '/api'}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabase.auth.session?.access_token || ""}`,
        },
        body: JSON.stringify({
          file_url: urlData.publicUrl,
          file_name: pdfFile.name,
          user_id: user.id,
        }),
      });
    } catch (err) {
      alert("File upload failed: " + err.message);
    }
    setUploading(false);
  };

  // (Preview logic removed due to no working PDF renderer dependency)

  // PUBLIC_INTERFACE
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!currentQuestion.trim()) return;
    setQaProcessing(true);
    const newChat = [
      ...chatHistory,
      { from: "user", text: currentQuestion, ts: Date.now() },
    ];
    setChatHistory(newChat);

    try {
      // Fetch answer from backend
      const resp = await fetch(
        `${process.env.REACT_APP_BACKEND_API_URL || "/api"}/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabase.auth.session?.access_token || ""}`,
          },
          body: JSON.stringify({
            question: currentQuestion,
            user_id: user.id,
            file_url: uploadedFileUrl,
          }),
        }
      );
      const data = await resp.json();

      setChatHistory((c) => [
        ...c,
        { from: "bot", text: data.answer || "No answer available.", ts: Date.now() },
      ]);
    } catch (err) {
      setChatHistory((c) => [
        ...c,
        { from: "bot", text: `Error: ${err.message}`, ts: Date.now() },
      ]);
    }
    setQaProcessing(false);
    setCurrentQuestion("");
  };

  /* UI COMPONENTS BELOW */
  return (
    <div className="App">
      <header className="App-header" style={{ minHeight: "64px", width: "100%" }}>
        <nav className="navbar" style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-secondary)",
          padding: "0.75rem 1.25rem",
          borderBottom: "1px solid var(--border-color)"
        }}>
          <div className="logo" style={{ fontWeight: 700, fontSize: 22, color: "var(--text-primary)" }}>
            DocQuery Hub
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              className="theme-toggle"
              onClick={() => setTheme(t => (t === "light" ? "dark" : "light"))}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    background: "var(--button-bg)", color: "var(--button-text)",
                    border: 0, borderRadius: 4, padding: "5px 10px", cursor: "pointer"
                  }}
                >Logout</button>
              </div>
            ) : null}
          </div>
        </nav>
      </header>

      <main style={{
        maxWidth: 580, margin: "auto", padding: "1rem", marginTop: 24,
        background: "var(--bg-secondary)", borderRadius: 8, boxShadow: "0 2px 12px #0002",
        minHeight: 360
      }}>
        {/* Auth view */}
        {!user && (
          <div style={{ maxWidth: 400, margin: "auto", padding: 16 }}>
            <h2 style={{ color: "var(--primary)" }}>
              {authView === "sign_in" ? "Sign In" : "Sign Up"}
            </h2>
            <form
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
              onSubmit={authView === "sign_in" ? handleSignIn : handleSignUp}
            >
              <input
                type="email"
                required
                disabled={authProcessing}
                placeholder="Email"
                style={{ fontSize: 16, padding: 8, borderRadius: 4, border: "1px solid var(--border-color)" }}
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                required
                disabled={authProcessing}
                placeholder="Password"
                style={{ fontSize: 16, padding: 8, borderRadius: 4, border: "1px solid var(--border-color)" }}
                value={password}
                autoComplete={authView === "sign_in" ? "current-password" : "new-password"}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="submit"
                disabled={authProcessing}
                style={{
                  background: "var(--button-bg)", color: "var(--button-text)",
                  border: 0, borderRadius: 4, padding: "10px 0px", fontWeight: 600, fontSize: 16, cursor: "pointer"
                }}
              >
                {authProcessing ? "Processing..." : (authView === "sign_in" ? "Sign In" : "Sign Up")}
              </button>
              {authError && <span style={{ color: "red" }}>{authError}</span>}
            </form>
            <div style={{ marginTop: 18, textAlign: "center" }}>
              {authView === "sign_in" ? (
                <span>
                  No account?{" "}
                  <button style={{
                    color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline"
                  }} onClick={() => setAuthView("sign_up")}>Sign up</button>
                </span>
              ) : (
                <span>
                  Already registered?{" "}
                  <button style={{
                    color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline"
                  }} onClick={() => setAuthView("sign_in")}>Sign in</button>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Main file upload, preview, and chat view */}
        {user && (
          <>
            <h2>Upload and Chat About Your PDF 📄🤖</h2>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: 18
            }}>
              {/* File Upload */}
              <div>
                <input
                  type="file"
                  accept=".pdf"
                  disabled={uploading}
                  onChange={handleFileChange}
                />
                <button
                  onClick={handleFileUpload}
                  disabled={!pdfFile || uploading}
                  style={{
                    marginLeft: 8,
                    background: "var(--button-bg)",
                    color: "var(--button-text)",
                    border: 0,
                    borderRadius: 6,
                    padding: "8px 16px",
                    fontWeight: "bold",
                    cursor: uploading ? "not-allowed" : "pointer"
                  }}
                >
                  {uploading ? "Uploading..." : "Upload PDF"}
                </button>
                {pdfFile && <span style={{ marginLeft: 12, fontSize: 14 }}>{pdfFile.name}</span>}
              </div>
              {/* PDF Preview (temporarily unavailable) */}
              {uploadedFileUrl && (
                <div style={{
                  background: "#fff",
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  padding: 12,
                  margin: "auto",
                  boxShadow: "0 2px 6px #0001",
                  maxHeight: 400,
                  minHeight: 40,
                  overflow: "auto",
                }}>
                  <h4 style={{ marginBottom: 4 }}>{uploadedFileName}</h4>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "gray", fontSize: 14, minHeight: 30 }}>
                    PDF preview not available in this build.
                  </div>
                </div>
              )}
              {/* Q&A Chat */}
              {uploadedFileUrl && (
                <div style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  padding: 14,
                  marginTop: 14,
                  maxHeight: 360,
                  overflow: "auto",
                  display: "flex",
                  flexDirection: "column"
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Ask questions about your PDF!
                  </div>
                  <div style={{
                    flex: 1,
                    maxHeight: 180,
                    overflowY: "auto",
                    marginBottom: 8,
                    background: "#fafafd",
                    padding: 8,
                    borderRadius: 4
                  }}>
                    {chatHistory.length === 0 && (
                      <div style={{ color: "gray", fontSize: 14 }}>
                        Start the conversation by asking a question about your uploaded file.
                      </div>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div
                        key={msg.ts + "-" + i}
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          marginBottom: 8,
                          alignItems: "flex-start"
                        }}>
                        <span
                          style={{
                            fontWeight: msg.from === "user" ? 600 : 400,
                            marginRight: 5,
                            color: msg.from === "user" ? "var(--button-bg)" : "#1976d2"
                          }}>
                          {msg.from === "user" ? "You:" : "DocBot:"}
                        </span>
                        <span style={{
                          background: msg.from === "user" ? "#e0e7ff" : "#f4f7fa",
                          borderRadius: 6,
                          padding: "6px 10px",
                          flex: 1,
                          fontSize: 15
                        }}>{msg.text}</span>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <form
                    onSubmit={handleAskQuestion}
                    style={{ display: "flex", gap: 8, width: "100%" }}
                  >
                    <input
                      type="text"
                      placeholder="Ask your question..."
                      value={currentQuestion}
                      autoComplete="off"
                      onChange={e => setCurrentQuestion(e.target.value)}
                      disabled={qaProcessing}
                      style={{
                        flex: 1,
                        padding: 8,
                        border: "1px solid var(--border-color)",
                        borderRadius: 5,
                        fontSize: 15
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!currentQuestion.trim() || qaProcessing}
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--button-text)",
                        border: 0,
                        borderRadius: 5,
                        padding: "8px 16px",
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: qaProcessing ? "not-allowed" : "pointer"
                      }}
                    >{qaProcessing ? "Asking..." : "Ask"}</button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </main>
      <footer style={{ margin: "30px 0 0 0", fontSize: 13, color: "gray" }}>
        &copy; {new Date().getFullYear()} DocQuery Hub. Powered by Supabase &middot; Minimal React.
      </footer>
    </div>
  );
}

export default App;
