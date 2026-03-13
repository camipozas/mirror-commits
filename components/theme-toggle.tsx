"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	const [dark, setDark] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		setDark(document.documentElement.classList.contains("dark"));
	}, []);

	function toggle() {
		const next = !dark;
		setDark(next);
		document.documentElement.classList.toggle("dark", next);
		localStorage.setItem("theme", next ? "dark" : "light");
	}

	if (!mounted) return <div className="w-8 h-8" />;

	return (
		<button
			type="button"
			onClick={toggle}
			className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-muted hover:text-text hover:bg-card-hover transition-colors"
			aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
		>
			{dark ? <Sun size={14} /> : <Moon size={14} />}
		</button>
	);
}
