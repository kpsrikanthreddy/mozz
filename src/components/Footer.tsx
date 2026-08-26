import React from 'react';
import { Sparkles, MapPin, Clock, Phone, Heart, Instagram, MessageSquare, ShieldAlert } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: 'menu' | 'track' | 'admin') => void;
  onOpenShapeGuide: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenShapeGuide }) => {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-850 text-zinc-400 text-xs mt-16 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black bg-gradient-to-r from-amber-400 via-red-400 to-amber-200 bg-clip-text text-transparent">
                MOZZ
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 font-semibold border border-zinc-800">
                Chinese & Pizzateria
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Where India Meets Every Slice • Different Flavors. Same Love.
              Introducing authentic Korean-Style Pocket Pizzas baked fresh to order in 3 custom shapes (R, C, S).
            </p>

            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://instagram.com/mozzpizzateria"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500 flex items-center justify-center text-zinc-300 hover:text-amber-400 transition"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://wa.me/?text=Hi%20MOZZ%20Team%2C%20I%20would%20like%20to%20order"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500 flex items-center justify-center text-zinc-300 hover:text-emerald-400 transition"
              >
                <MessageSquare className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Pocket Pizza Shape Guide */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Korean Pocket Pizza Shapes
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <span className="font-bold text-amber-400">[R]</span>
                <span><strong>Rectangular:</strong> Bigger bites, more delight (Regular)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-amber-400">[C]</span>
                <span><strong>Circular:</strong> Classic shape, timeless taste (Classic)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-amber-400">[S]</span>
                <span><strong>Square:</strong> Perfect edges, perfect share (Signature)</span>
              </li>
            </ul>
            <button
              onClick={onOpenShapeGuide}
              className="text-amber-400 hover:text-amber-300 underline font-semibold text-xs transition"
            >
              Open Full Shape Guide →
            </button>
          </div>

          {/* Timings & Delivery */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Store Timings & Outlets
            </h4>
            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-400" />
                <span>Monday – Sunday: 03:00 PM – 12:30 AM</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>MOZZ Pizzateria and Chinese, Gachibowli / City Hub</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Customer Helpline: +91 81796 20607</span>
              </div>
            </div>
          </div>

          {/* Quick Staff Links & Safety */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Navigation & Staff
            </h4>
            <div className="flex flex-col space-y-1.5 text-xs">
              <button
                onClick={() => onNavigate('menu')}
                className="text-left text-zinc-300 hover:text-amber-400 transition"
              >
                Full Menu & Chinese Specials
              </button>
              <button
                onClick={() => onNavigate('track')}
                className="text-left text-zinc-300 hover:text-amber-400 transition"
              >
                Live Order Tracking & ETA Map
              </button>
              <button
                onClick={() => onNavigate('admin')}
                className="text-left text-amber-400/90 hover:text-amber-300 flex items-center gap-1.5 transition font-semibold pt-1"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Staff Admin Portal Login
              </button>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <div>
            © {new Date().getFullYear()} MOZZ Chinese & Pizzateria. All rights reserved. Razorpay UPI integrated.
          </div>
          <div className="flex items-center gap-1 text-zinc-400">
            <span>Freshly baked with love for foodies</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
