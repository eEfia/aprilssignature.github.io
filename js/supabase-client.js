(function () {

    "use strict";

    if (!window.APRILS_SUPABASE_CONFIG) {

        console.error(
            "Supabase configuration was not found."
        );

        return;

    }

    const url =
        window.APRILS_SUPABASE_CONFIG.url;

    const key =
        window.APRILS_SUPABASE_CONFIG.publishab;


    function loadSupabase() {

        return new Promise(function(resolve,reject){

            if (
                window.supabase &&
                typeof window.supabase.createClient === "function"
            ) {

                resolve();

                return;

            }


            const script =
                document.createElement("script");

            script.src =
                "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

            script.onload =
                function(){

                    resolve();

                };

            script.onerror =
                function(){

                    reject(
                        new Error(
                            "Supabase library failed to load."
                        )
                    );

                };

            document.head.appendChild(script);

        });

    }


    loadSupabase()

    .then(function(){

        window.aprilsSupabase =
            window.supabase.createClient(
                url,
                key
            );

        window.AprilsSupabase =
            window.aprilsSupabase;

        window.dispatchEvent(
            new Event(
                "aprilsSupabaseReady"
            )
        );

        console.log(
            "Aprils Signature Supabase connected."
        );

    })

    .catch(function(error){

        console.error(
            "Supabase connection failed:",
            error
        );

        window.aprilsSupabaseError =
            error;

    });

})();
