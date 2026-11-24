import { Routes, Route } from 'react-router'
import './App.css'

import Register from "./pages/register"
import Login from "./pages/login"
import Landing from './pages/landing'
import Dashboard from './pages/dashboard'
import Project from "./pages/project"
import Create from "./pages/create"

function App() {

  return (
    <>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/project/:id" element={<Project />} />
      <Route path="/project/:id/create" element={<Create />} />
    </Routes>
    </>
  )
}

export default App
