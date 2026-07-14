import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayStore } from '../../store/overlayStore';
import { AnimatePresence, motion } from 'framer-motion';

interface OverlayShellProps {
    children: ReactNode;
}

export function OverlayShell({ children }: OverlayShellProps) {
    const { isVisible } = useOverlayStore();
    const portalRoot = document.body;

    return createPortal(
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[999999] pointer-events-none flex justify-center items-start pt-2 overflow-visible">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="pointer-events-auto origin-top"
                    >
                        {children}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        portalRoot
    );
}
