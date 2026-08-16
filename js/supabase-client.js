(function () {
    "use strict";

    function initializeSupabase() {

        if (
            !window.APRILS_SUPABASE_URL ||
            !window.APRILS_SUPABASE_KEY
        ) {
            console.error(
                "Aprils Signature Supabase configuration is missing."
            );
            return;
        }

        if (window.aprilsSupabase) {
            document.dispatchEvent(
                new Event("aprilsSupabaseReady")
            );
            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

        script.onload = function () {

            window.aprilsSupabase =
                window.supabase.createClient(
                    window.APRILS_SUPABASE_URL,
                    window.APRILS_SUPABASE_KEY
                );

            document.dispatchEvent(
                new Event("aprilsSupabaseReady")
            );
        };

        script.onerror = function () {

            console.error(
                "Unable to load Supabase."
            );

        };

        document.head.appendChild(script);
    }

    initializeSupabase();

})();
