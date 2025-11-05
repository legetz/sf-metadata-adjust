/**
 * Contains methods related to platform limits
 */
public class LimitHelper {
	public static Integer getCalloutsRemaining() {
		return Limits.getLimitCallouts() - Limits.getCallouts();
	}
}