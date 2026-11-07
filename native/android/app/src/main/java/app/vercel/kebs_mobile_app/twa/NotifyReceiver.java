package app.vercel.kebs_mobile_app.twa;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires a scheduled KEBS reminder (set by Notifier.syncSchedule), even when the app is closed. */
public class NotifyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent i) {
        Notifier.show(ctx, i.getIntExtra("id", 2), i.getStringExtra("cat"), i.getStringExtra("title"), i.getStringExtra("body"), i.getStringExtra("route"));
    }
}
